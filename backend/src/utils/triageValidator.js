/**
 * Triage Output Validator
 * 
 * Validates structured JSON output from the AI triage agent.
 * If validation fails, the system retries, then escalates to human review.
 */

const VALID_URGENCY_LEVELS = ['EMERGENCY', 'URGENT', 'ROUTINE', 'NON_URGENT'];

const VALID_SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Neurology', 'Dermatology',
  'Orthopedics', 'Pediatrics', 'ENT', 'Gastroenterology',
  'Psychiatry', 'Pulmonology'
];

/**
 * Validate triage AI output
 * @param {object} output - Raw AI output (parsed JSON)
 * @returns {{ valid: boolean, errors: string[], sanitized: object|null }}
 */
function validateTriageOutput(output) {
  const errors = [];
  
  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['Output is not a valid object'], sanitized: null };
  }
  
  // Required field: urgency
  if (!output.urgency) {
    errors.push('Missing required field: urgency');
  } else if (!VALID_URGENCY_LEVELS.includes(output.urgency)) {
    errors.push(`Invalid urgency value: "${output.urgency}". Must be one of: ${VALID_URGENCY_LEVELS.join(', ')}`);
  }
  
  // Required field: risk_score (0-10)
  if (output.risk_score === undefined || output.risk_score === null) {
    errors.push('Missing required field: risk_score');
  } else {
    const score = parseFloat(output.risk_score);
    if (isNaN(score) || score < 0 || score > 10) {
      errors.push(`Invalid risk_score: "${output.risk_score}". Must be a number between 0 and 10`);
    }
  }
  
  // Required field: specialty
  if (!output.specialty) {
    errors.push('Missing required field: specialty');
  } else if (!VALID_SPECIALTIES.includes(output.specialty)) {
    // Try fuzzy match
    const matched = VALID_SPECIALTIES.find(s => 
      s.toLowerCase() === output.specialty.toLowerCase() ||
      s.toLowerCase().includes(output.specialty.toLowerCase()) ||
      output.specialty.toLowerCase().includes(s.toLowerCase())
    );
    if (!matched) {
      errors.push(`Invalid specialty: "${output.specialty}". Must be one of: ${VALID_SPECIALTIES.join(', ')}`);
    } else {
      output.specialty = matched; // Auto-correct casing
    }
  }
  
  // Required field: summary
  if (!output.summary || typeof output.summary !== 'string') {
    errors.push('Missing required field: summary');
  } else if (output.summary.length > 2000) {
    errors.push('Summary exceeds maximum length of 2000 characters');
  }
  
  // Required field: recommended_next_step
  if (!output.recommended_next_step || typeof output.recommended_next_step !== 'string') {
    errors.push('Missing required field: recommended_next_step');
  }
  
  // Required field: confidence (0-1)
  if (output.confidence === undefined || output.confidence === null) {
    errors.push('Missing required field: confidence');
  } else {
    const conf = parseFloat(output.confidence);
    if (isNaN(conf) || conf < 0 || conf > 1) {
      errors.push(`Invalid confidence: "${output.confidence}". Must be a number between 0 and 1`);
    }
  }
  
  // Required field: requires_human_review (boolean)
  if (output.requires_human_review === undefined) {
    errors.push('Missing required field: requires_human_review');
  } else if (typeof output.requires_human_review !== 'boolean') {
    // Try to coerce
    output.requires_human_review = Boolean(output.requires_human_review);
  }
  
  // Optional but validated: red_flags (array of strings)
  if (output.red_flags !== undefined) {
    if (!Array.isArray(output.red_flags)) {
      errors.push('red_flags must be an array');
    } else {
      output.red_flags = output.red_flags.filter(f => typeof f === 'string' && f.length > 0).slice(0, 20);
    }
  } else {
    output.red_flags = [];
  }
  
  // Optional but validated: clinician_review_points (array of strings)
  if (output.clinician_review_points !== undefined) {
    if (!Array.isArray(output.clinician_review_points)) {
      errors.push('clinician_review_points must be an array');
    } else {
      output.clinician_review_points = output.clinician_review_points.filter(p => typeof p === 'string' && p.length > 0).slice(0, 20);
    }
  } else {
    output.clinician_review_points = [];
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, sanitized: null };
  }
  
  // Sanitize and return
  const sanitized = {
    urgency: output.urgency,
    risk_score: parseFloat(output.risk_score),
    specialty: output.specialty,
    red_flags: output.red_flags,
    summary: output.summary.substring(0, 2000),
    clinician_review_points: output.clinician_review_points,
    recommended_next_step: output.recommended_next_step.substring(0, 500),
    confidence: parseFloat(output.confidence),
    requires_human_review: Boolean(output.requires_human_review),
  };
  
  return { valid: true, errors: [], sanitized };
}

/**
 * Try to parse JSON from AI text output, handling markdown code blocks
 */
function parseAIJson(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try extracting from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        // Fall through
      }
    }
    
    // Try finding JSON object in text
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch (e3) {
        // Fall through
      }
    }
    
    return null;
  }
}

module.exports = { validateTriageOutput, parseAIJson, VALID_URGENCY_LEVELS, VALID_SPECIALTIES };
