/**
 * Deterministic Safety Engine
 * 
 * CRITICAL: These rules CANNOT be overridden by LLM output.
 * They represent configurable red-flag patterns that trigger
 * emergency escalation regardless of AI triage results.
 * 
 * DISCLAIMER: These are DEMO rules for a portfolio project.
 * They are NOT a medically exhaustive or clinically validated rule set.
 */

const EMERGENCY_KEYWORD_PATTERNS = [
  // Cardiac emergencies
  { pattern: /chest\s*(pain|pressure|tightness|discomfort)/i, category: 'cardiac', description: 'Chest pain/pressure reported' },
  { pattern: /heart\s*attack/i, category: 'cardiac', description: 'Heart attack mentioned' },
  { pattern: /cardiac\s*arrest/i, category: 'cardiac', description: 'Cardiac arrest mentioned' },
  
  // Respiratory emergencies
  { pattern: /(severe|significant|extreme|serious)\s*(difficulty|trouble|problem)\s*(breathing|breath)/i, category: 'respiratory', description: 'Severe breathing difficulty' },
  { pattern: /can\s*'?t\s*breathe/i, category: 'respiratory', description: 'Unable to breathe' },
  { pattern: /choking/i, category: 'respiratory', description: 'Choking reported' },
  
  // Neurological emergencies
  { pattern: /stroke/i, category: 'neurological', description: 'Stroke symptoms mentioned' },
  { pattern: /(sudden|severe)\s*(numbness|weakness|paralysis)\s*(face|arm|leg|side)/i, category: 'neurological', description: 'Sudden neurological deficit' },
  { pattern: /loss\s*of\s*consciousness/i, category: 'neurological', description: 'Loss of consciousness' },
  { pattern: /faint(ed|ing)|passed?\s*out|unconscious/i, category: 'neurological', description: 'Fainting/unconsciousness' },
  { pattern: /(sudden|worst)\s*(headache|head\s*ache)\s*(ever|of\s*my\s*life)/i, category: 'neurological', description: 'Worst headache ever — possible hemorrhage indicator' },
  
  // Hemorrhagic emergencies
  { pattern: /(severe|heavy|uncontrolled|won'?t\s*stop)\s*(bleed|blood)/i, category: 'hemorrhagic', description: 'Severe/uncontrolled bleeding' },
  { pattern: /coughing\s*(up\s*)?blood/i, category: 'hemorrhagic', description: 'Hemoptysis reported' },
  { pattern: /vomiting\s*(up\s*)?blood/i, category: 'hemorrhagic', description: 'Hematemesis reported' },
  
  // Allergic emergencies
  { pattern: /anaphyla(xis|ctic)/i, category: 'allergic', description: 'Anaphylaxis reported' },
  { pattern: /(severe|serious)\s*allergic\s*reaction/i, category: 'allergic', description: 'Severe allergic reaction' },
  { pattern: /(throat|tongue|lip)\s*(swell|closing|tight)/i, category: 'allergic', description: 'Airway swelling reported' },
  
  // Mental health emergencies
  { pattern: /suicid(e|al)/i, category: 'mental_health', description: 'Suicidal ideation/mention' },
  { pattern: /self[\s-]*harm/i, category: 'mental_health', description: 'Self-harm reported' },
  { pattern: /(want|plan|going)\s*to\s*(kill|hurt|end)\s*(myself|my\s*life)/i, category: 'mental_health', description: 'Active self-harm intent' },
  
  // Trauma
  { pattern: /(severe|serious|major)\s*(injury|trauma|accident|wound)/i, category: 'trauma', description: 'Severe injury/trauma' },
  { pattern: /overdos(e|ed|ing)/i, category: 'toxicological', description: 'Overdose reported' },
  { pattern: /poison(ed|ing)/i, category: 'toxicological', description: 'Poisoning reported' },
  
  // Seizure
  { pattern: /seizure|convulsion/i, category: 'neurological', description: 'Seizure/convulsion reported' },
];

const RISK_THRESHOLDS = {
  EMERGENCY: parseFloat(process.env.SAFETY_RISK_SCORE_EMERGENCY || '8'),
  URGENT: parseFloat(process.env.SAFETY_RISK_SCORE_URGENT || '5'),
};

const CONFIDENCE_THRESHOLD = parseFloat(process.env.SAFETY_CONFIDENCE_THRESHOLD || '0.7');

/**
 * Evaluate patient input against deterministic safety rules.
 * This runs AFTER AI triage and can OVERRIDE AI results upward (never downward).
 * 
 * @param {object} params
 * @param {string} params.symptoms - Raw symptom text from patient
 * @param {object} params.triageResult - Structured AI triage output
 * @returns {object} Safety evaluation result
 */
function evaluateSafety({ symptoms, triageResult }) {
  const triggeredRules = [];
  const symptomsText = (symptoms || '').toLowerCase();
  const allText = `${symptomsText} ${(triageResult?.summary || '').toLowerCase()} ${(triageResult?.red_flags || []).join(' ').toLowerCase()}`;
  
  // Check keyword patterns against all available text
  for (const rule of EMERGENCY_KEYWORD_PATTERNS) {
    if (rule.pattern.test(allText)) {
      triggeredRules.push({
        category: rule.category,
        description: rule.description,
        pattern: rule.pattern.toString(),
        matched_in: rule.pattern.test(symptomsText) ? 'patient_input' : 'ai_output',
      });
    }
  }
  
  // Check AI triage risk score thresholds
  let riskScoreFlag = false;
  if (triageResult?.risk_score >= RISK_THRESHOLDS.EMERGENCY) {
    riskScoreFlag = true;
    triggeredRules.push({
      category: 'risk_score',
      description: `Risk score ${triageResult.risk_score} exceeds emergency threshold ${RISK_THRESHOLDS.EMERGENCY}`,
    });
  }
  
  // Check if AI flagged emergency but with low confidence
  let lowConfidenceFlag = false;
  if (triageResult?.urgency === 'EMERGENCY' && triageResult?.confidence < CONFIDENCE_THRESHOLD) {
    lowConfidenceFlag = true;
    triggeredRules.push({
      category: 'low_confidence',
      description: `Emergency classification with low confidence ${triageResult.confidence} (threshold: ${CONFIDENCE_THRESHOLD})`,
    });
  }
  
  // Check if AI said emergency
  const aiSaysEmergency = triageResult?.urgency === 'EMERGENCY';
  
  // Determine final urgency — rules can only escalate, never downgrade
  const keywordEmergency = triggeredRules.some(r => r.category !== 'risk_score' && r.category !== 'low_confidence');
  const isEmergency = keywordEmergency || riskScoreFlag || aiSaysEmergency;
  const isUrgent = !isEmergency && (
    triageResult?.urgency === 'URGENT' ||
    (triageResult?.risk_score >= RISK_THRESHOLDS.URGENT)
  );
  
  let finalUrgency;
  if (isEmergency) {
    finalUrgency = 'EMERGENCY';
  } else if (isUrgent) {
    finalUrgency = 'URGENT';
  } else {
    finalUrgency = triageResult?.urgency || 'ROUTINE';
  }
  
  // Determine if a deterministic override occurred (rules changed AI's assessment)
  const deterministicOverride = keywordEmergency && triageResult?.urgency !== 'EMERGENCY';
  
  return {
    passed: !isEmergency,
    final_urgency: finalUrgency,
    is_emergency: isEmergency,
    requires_human_review: isEmergency || lowConfidenceFlag || (triageResult?.requires_human_review === true),
    deterministic_override: deterministicOverride,
    triggered_rules: triggeredRules,
    risk_score: triageResult?.risk_score || 0,
    confidence: triageResult?.confidence || 0,
    evaluation_timestamp: new Date().toISOString(),
    thresholds: {
      emergency_risk: RISK_THRESHOLDS.EMERGENCY,
      urgent_risk: RISK_THRESHOLDS.URGENT,
      confidence: CONFIDENCE_THRESHOLD,
    },
  };
}

/**
 * Quick pre-triage safety scan on raw symptoms
 * Used to flag potential emergencies even before AI triage runs
 */
function quickSafetyScan(symptoms) {
  const triggeredRules = [];
  const symptomsText = (symptoms || '').toLowerCase();
  
  for (const rule of EMERGENCY_KEYWORD_PATTERNS) {
    if (rule.pattern.test(symptomsText)) {
      triggeredRules.push({
        category: rule.category,
        description: rule.description,
      });
    }
  }
  
  return {
    has_emergency_indicators: triggeredRules.length > 0,
    triggered_rules: triggeredRules,
  };
}

module.exports = { evaluateSafety, quickSafetyScan, EMERGENCY_KEYWORD_PATTERNS, RISK_THRESHOLDS };
