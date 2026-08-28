/**
 * Input Validation Middleware
 */

function validateIntakeInput(req, res, next) {
  const errors = [];
  const body = req.body;
  
  // Required fields
  if (!body.full_name || typeof body.full_name !== 'string' || body.full_name.trim().length < 2) {
    errors.push('full_name is required (min 2 characters)');
  } else if (body.full_name.length > 200) {
    errors.push('full_name must be 200 characters or less');
  }
  
  if (!body.email || typeof body.email !== 'string') {
    errors.push('email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('email must be a valid email address');
  }
  
  if (!body.symptoms || typeof body.symptoms !== 'string' || body.symptoms.trim().length < 5) {
    errors.push('symptoms is required (min 5 characters)');
  } else if (body.symptoms.length > 5000) {
    errors.push('symptoms must be 5000 characters or less');
  }
  
  // Optional but validated fields
  if (body.age !== undefined && body.age !== null && body.age !== '') {
    const age = parseInt(body.age);
    if (isNaN(age) || age < 0 || age > 150) {
      errors.push('age must be a number between 0 and 150');
    }
  }
  
  if (body.phone && typeof body.phone === 'string' && body.phone.length > 30) {
    errors.push('phone must be 30 characters or less');
  }
  
  if (body.severity && !['MILD', 'MODERATE', 'SEVERE', 'CRITICAL'].includes(body.severity)) {
    errors.push('severity must be one of: MILD, MODERATE, SEVERE, CRITICAL');
  }
  
  if (body.preferred_communication && !['email', 'phone', 'sms'].includes(body.preferred_communication)) {
    errors.push('preferred_communication must be one of: email, phone, sms');
  }
  
  // Check for extremely long text fields (DoS protection)
  for (const field of ['existing_conditions', 'current_medications', 'allergies', 'symptom_duration', 'preferred_appointment_time']) {
    if (body[field] && typeof body[field] === 'string' && body[field].length > 2000) {
      errors.push(`${field} must be 2000 characters or less`);
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Input validation failed',
      errors,
    });
  }
  
  // Sanitize inputs
  req.body.full_name = body.full_name.trim();
  req.body.email = body.email.trim().toLowerCase();
  req.body.symptoms = body.symptoms.trim();
  if (body.phone) req.body.phone = body.phone.trim();
  
  next();
}

function validateUUID(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return res.status(400).json({ error: 'INVALID_ID', message: `${paramName} must be a valid UUID` });
    }
    next();
  };
}

module.exports = { validateIntakeInput, validateUUID };
