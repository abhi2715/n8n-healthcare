/**
 * AI Triage Service
 * 
 * Uses Groq LLM to perform AI-assisted triage.
 * The AI acts as an administrative assistant, NOT a clinician.
 * Output is always validated against a strict schema.
 * Results are ALWAYS subject to the deterministic safety engine.
 */
const Groq = require('groq-sdk');
const { validateTriageOutput, parseAIJson, VALID_SPECIALTIES } = require('../utils/triageValidator');
const auditLogger = require('./auditLogger');

const MAX_RETRIES = 2;
const TIMEOUT_MS = 30000;

let groqClient = null;

function getGroqClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'gsk_your_groq_api_key_here') {
      return null;
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

const TRIAGE_SYSTEM_PROMPT = `You are an administrative triage assistant for a healthcare clinic. Your role is to review patient intake information and provide a structured administrative assessment to help clinical staff prioritize and route patients.

IMPORTANT RULES:
1. You are NOT a clinician. You do NOT diagnose diseases.
2. You NEVER tell a patient what disease they have.
3. You identify potential concerns that warrant clinician review.
4. You classify urgency for administrative routing purposes only.
5. All your assessments require human clinician review before any clinical action.

You MUST respond with a JSON object matching this exact schema:
{
  "urgency": "EMERGENCY | URGENT | ROUTINE | NON_URGENT",
  "risk_score": <number 0-10>,
  "specialty": "<one of: ${VALID_SPECIALTIES.join(', ')}>",
  "red_flags": ["<string>"],
  "summary": "<brief administrative summary of the intake>",
  "clinician_review_points": ["<specific points for clinician attention>"],
  "recommended_next_step": "<administrative next step>",
  "confidence": <number 0-1>,
  "requires_human_review": <boolean>
}

Urgency guidelines:
- EMERGENCY: Symptoms suggesting immediate danger to life (chest pain with breathing difficulty, stroke signs, severe bleeding, loss of consciousness, anaphylaxis, self-harm crisis)
- URGENT: Symptoms needing attention within 24-48 hours (high fever, significant pain, acute infections, worsening chronic conditions)
- ROUTINE: Standard appointment needs (regular checkups, mild ongoing symptoms, medication reviews, minor concerns)
- NON_URGENT: Informational or preventive (wellness checks, routine questions, follow-up scheduling, health education)

ALWAYS set requires_human_review to true if:
- Urgency is EMERGENCY or URGENT
- Risk score >= 7
- Any red flags are identified
- You are uncertain about the classification (confidence < 0.7)
- Patient mentions multiple serious symptoms

Respond ONLY with the JSON object. No additional text.`;

/**
 * Perform AI-assisted triage
 * @param {object} intake - Patient intake data
 * @returns {object} Validated triage result or error
 */
async function performTriage(intake) {
  const client = getGroqClient();
  
  if (!client) {
    console.warn('[AI TRIAGE] Groq API key not configured — using fallback triage');
    return fallbackTriage(intake);
  }
  
  const patientContext = buildPatientContext(intake);
  let lastError = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();
    
    try {
      const completion = await Promise.race([
        client.chat.completions.create({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
            { role: 'user', content: patientContext },
          ],
          temperature: 0.1,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), TIMEOUT_MS)),
      ]);
      
      const latencyMs = Date.now() - startTime;
      const rawOutput = completion.choices[0]?.message?.content;
      const parsed = parseAIJson(rawOutput);
      
      if (!parsed) {
        lastError = `Attempt ${attempt + 1}: Failed to parse AI response as JSON`;
        console.warn(`[AI TRIAGE] ${lastError}`);
        
        await auditLogger.logEvent({
          eventType: 'AI_FAILURE',
          intakeId: intake.id,
          patientId: intake.patient_id,
          aiInvolved: true,
          action: 'Triage AI output parse failure',
          result: 'error',
          details: { attempt: attempt + 1, raw_output: rawOutput?.substring(0, 500) },
          errorMessage: lastError,
        });
        continue;
      }
      
      const validation = validateTriageOutput(parsed);
      
      if (!validation.valid) {
        lastError = `Attempt ${attempt + 1}: Validation failed: ${validation.errors.join('; ')}`;
        console.warn(`[AI TRIAGE] ${lastError}`);
        
        await auditLogger.logEvent({
          eventType: 'AI_FAILURE',
          intakeId: intake.id,
          patientId: intake.patient_id,
          aiInvolved: true,
          action: 'Triage AI output validation failure',
          result: 'error',
          details: { attempt: attempt + 1, validation_errors: validation.errors, parsed_output: parsed },
          errorMessage: lastError,
        });
        continue;
      }
      
      // Success!
      const triageResult = {
        ...validation.sanitized,
        ai_model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        ai_raw_output: parsed,
        ai_prompt_tokens: completion.usage?.prompt_tokens,
        ai_completion_tokens: completion.usage?.completion_tokens,
        ai_latency_ms: latencyMs,
        ai_retry_count: attempt,
      };
      
      await auditLogger.logEvent({
        eventType: 'TRIAGE_COMPLETED',
        intakeId: intake.id,
        patientId: intake.patient_id,
        aiInvolved: true,
        action: 'AI triage completed successfully',
        result: 'success',
        details: {
          urgency: triageResult.urgency,
          risk_score: triageResult.risk_score,
          specialty: triageResult.specialty,
          confidence: triageResult.confidence,
          latency_ms: latencyMs,
          attempt: attempt + 1,
        },
        durationMs: latencyMs,
      });
      
      return { success: true, triage: triageResult };
      
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      lastError = `Attempt ${attempt + 1}: ${err.message}`;
      console.error(`[AI TRIAGE] ${lastError}`);
      
      await auditLogger.logEvent({
        eventType: 'AI_FAILURE',
        intakeId: intake.id,
        patientId: intake.patient_id,
        aiInvolved: true,
        action: `Triage AI call failed: ${err.message}`,
        result: 'error',
        details: { attempt: attempt + 1, error_type: err.message === 'AI_TIMEOUT' ? 'timeout' : 'api_error' },
        errorMessage: err.message,
        durationMs: latencyMs,
      });
    }
  }
  
  // All retries exhausted — fallback
  console.error('[AI TRIAGE] All retries exhausted, using fallback triage');
  return {
    success: false,
    error: lastError,
    triage: fallbackTriage(intake).triage,
    requires_human_review: true,
    ai_failed: true,
  };
}

/**
 * Fallback triage when AI is unavailable
 */
function fallbackTriage(intake) {
  const severity = intake.severity || 'MILD';
  const urgencyMap = { CRITICAL: 'EMERGENCY', SEVERE: 'URGENT', MODERATE: 'ROUTINE', MILD: 'NON_URGENT' };
  const riskMap = { CRITICAL: 9, SEVERE: 6, MODERATE: 3, MILD: 1 };
  
  return {
    success: true,
    triage: {
      urgency: urgencyMap[severity] || 'ROUTINE',
      risk_score: riskMap[severity] || 3,
      specialty: 'General Medicine',
      red_flags: [],
      summary: `[FALLBACK TRIAGE — AI unavailable] Patient reports: ${(intake.symptoms || '').substring(0, 200)}. Severity: ${severity}. Requires human clinician review.`,
      clinician_review_points: ['AI triage was unavailable — full clinician review required', `Patient-reported severity: ${severity}`],
      recommended_next_step: 'Route to General Medicine for clinician evaluation',
      confidence: 0,
      requires_human_review: true,
      ai_model: 'fallback',
      ai_raw_output: null,
      ai_retry_count: 0,
    },
    ai_failed: true,
  };
}

/**
 * Build patient context string for AI prompt
 */
function buildPatientContext(intake) {
  return `PATIENT INTAKE INFORMATION:

Full Name: ${intake.full_name || 'Not provided'}
Age: ${intake.age || 'Not provided'}
Date of Birth: ${intake.date_of_birth || 'Not provided'}

SYMPTOMS:
${intake.symptoms || 'Not provided'}

Symptom Duration: ${intake.symptom_duration || 'Not provided'}
Patient-Reported Severity: ${intake.severity || 'Not provided'}

EXISTING CONDITIONS:
${intake.existing_conditions || 'None reported'}

CURRENT MEDICATIONS:
${intake.current_medications || 'None reported'}

ALLERGIES:
${intake.allergies || 'None reported'}

Please provide your administrative triage assessment as a JSON object.`;
}

/**
 * Generate a doctor preparation brief using AI
 */
async function generateDoctorBrief(patient, intake, triage, appointment) {
  const client = getGroqClient();
  
  if (!client) {
    return generateFallbackBrief(patient, intake, triage, appointment);
  }
  
  try {
    const completion = await Promise.race([
      client.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a medical administrative assistant preparing a concise pre-appointment brief for a clinician. Summarize the patient information into a clear, scannable format. Mark all AI-generated content. Never provide a diagnosis. Output a JSON object with these fields:
{
  "patient_overview": "<brief demographic summary>",
  "reason_for_visit": "<primary reason from intake>",
  "symptom_timeline": "<when symptoms started, progression>",
  "relevant_history": "<existing conditions relevant to visit>",
  "current_medications": "<medications list>",
  "known_allergies": "<allergies list>",
  "ai_triage_summary": "<what the triage assessment found>",
  "potential_red_flags": ["<flags>"],
  "clinician_review_points": ["<specific things to check>"],
  "appointment_details": "<date, time, duration>"
}`,
          },
          {
            role: 'user',
            content: `Prepare a clinician brief for:
Patient: ${patient.first_name} ${patient.last_name}, Age ${patient.age || 'unknown'}
Symptoms: ${intake.symptoms}
Duration: ${intake.symptom_duration || 'not specified'}
Severity: ${intake.severity || 'not specified'}
Conditions: ${intake.existing_conditions || 'none reported'}
Medications: ${intake.current_medications || 'none reported'}
Allergies: ${intake.allergies || 'none reported'}
Triage Urgency: ${triage?.urgency || 'unknown'}
Red Flags: ${(triage?.red_flags || []).join(', ') || 'none'}
Appointment: ${appointment.appointment_date} at ${appointment.start_time}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), TIMEOUT_MS)),
    ]);
    
    const parsed = parseAIJson(completion.choices[0]?.message?.content);
    if (parsed) {
      return { success: true, brief: parsed };
    }
  } catch (err) {
    console.error('[AI BRIEF] Failed:', err.message);
  }
  
  return generateFallbackBrief(patient, intake, triage, appointment);
}

function generateFallbackBrief(patient, intake, triage, appointment) {
  return {
    success: true,
    brief: {
      patient_overview: `${patient.first_name} ${patient.last_name}, Age ${patient.age || 'unknown'}, ${patient.gender || 'gender not specified'}`,
      reason_for_visit: intake.symptoms?.substring(0, 300) || 'Not specified',
      symptom_timeline: `Duration: ${intake.symptom_duration || 'not specified'}. Severity: ${intake.severity || 'not specified'}`,
      relevant_history: intake.existing_conditions || 'None reported',
      current_medications: intake.current_medications || 'None reported',
      known_allergies: intake.allergies || 'None reported',
      ai_triage_summary: triage?.summary || 'AI triage unavailable — full clinician assessment required',
      potential_red_flags: triage?.red_flags || [],
      clinician_review_points: triage?.clinician_review_points || ['Full assessment required — AI brief generation was unavailable'],
      appointment_details: `${appointment.appointment_date} at ${appointment.start_time} (${appointment.duration_minutes} min)`,
    },
  };
}

/**
 * Classify a follow-up response using AI
 */
async function classifyFollowupResponse(patientResponse, context) {
  const client = getGroqClient();
  
  if (!client) {
    return { classification: 'UNCHANGED', confidence: 0, requires_escalation: false, ai_failed: true };
  }
  
  try {
    const completion = await Promise.race([
      client.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an administrative assistant classifying patient follow-up responses. You do NOT diagnose. You classify the response for routing purposes only.

Respond with JSON:
{
  "classification": "IMPROVING | UNCHANGED | WORSENING | URGENT_CONCERN",
  "confidence": <0-1>,
  "requires_escalation": <boolean>,
  "reason": "<brief explanation>",
  "follow_up_recommendation": "<next administrative step>"
}

Set requires_escalation=true if the patient mentions:
- Worsening symptoms
- New concerning symptoms
- Emergency indicators
- Medication adverse effects
- Significant distress`,
          },
          {
            role: 'user',
            content: `Original visit reason: ${context.reason || 'General consultation'}
Triage urgency: ${context.urgency || 'ROUTINE'}
Patient follow-up response: "${patientResponse}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), TIMEOUT_MS)),
    ]);
    
    const parsed = parseAIJson(completion.choices[0]?.message?.content);
    if (parsed) {
      return parsed;
    }
  } catch (err) {
    console.error('[AI FOLLOWUP] Classification failed:', err.message);
  }
  
  return { classification: 'UNCHANGED', confidence: 0, requires_escalation: false, ai_failed: true };
}

module.exports = { performTriage, generateDoctorBrief, classifyFollowupResponse };
