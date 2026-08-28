const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auditLogger = require('../services/auditLogger');

// POST /api/feedback
router.post('/', async (req, res) => {
  const { patient_id, appointment_id, doctor_id, satisfaction_score, communication_rating, waiting_experience, overall_experience, comments } = req.body;
  
  if (!patient_id) return res.status(400).json({ error: 'patient_id required' });
  
  for (const [field, value] of Object.entries({ satisfaction_score, communication_rating, waiting_experience, overall_experience })) {
    if (value !== undefined && (value < 1 || value > 5)) {
      return res.status(400).json({ error: `${field} must be between 1 and 5` });
    }
  }
  
  // Simple sentiment (no extra AI call needed for this)
  let sentiment = 'neutral';
  const avg = [satisfaction_score, communication_rating, waiting_experience, overall_experience].filter(Boolean);
  if (avg.length > 0) {
    const avgScore = avg.reduce((a, b) => a + b, 0) / avg.length;
    sentiment = avgScore >= 4 ? 'positive' : avgScore <= 2 ? 'negative' : 'neutral';
  }
  
  const result = await db.query(
    `INSERT INTO feedback (patient_id, appointment_id, doctor_id, satisfaction_score, communication_rating, waiting_experience, overall_experience, comments, sentiment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [patient_id, appointment_id, doctor_id, satisfaction_score, communication_rating, waiting_experience, overall_experience, comments, sentiment]
  );
  
  await auditLogger.logEvent({
    eventType: 'FEEDBACK_RECEIVED',
    patientId: patient_id,
    appointmentId: appointment_id,
    doctorId: doctor_id,
    action: `Feedback received: sentiment=${sentiment}, satisfaction=${satisfaction_score}`,
  });
  
  res.status(201).json({ feedback: result.rows[0], message: 'Thank you for your feedback!' });
});

// GET /api/feedback
router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT f.*, p.first_name, p.last_name FROM feedback f LEFT JOIN patients p ON f.patient_id = p.id ORDER BY f.created_at DESC LIMIT 50`
  );
  res.json({ feedback: result.rows });
});

module.exports = router;
