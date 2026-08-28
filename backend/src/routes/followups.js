const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { classifyFollowupResponse } = require('../services/aiTriage');
const auditLogger = require('../services/auditLogger');

// POST /api/followups — Submit follow-up response
router.post('/', async (req, res) => {
  const { followup_id, patient_response } = req.body;
  
  if (!followup_id || !patient_response) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'followup_id and patient_response are required' });
  }
  
  const followup = await db.query('SELECT f.*, a.reason FROM followups f LEFT JOIN appointments a ON f.appointment_id = a.id WHERE f.id = $1', [followup_id]);
  if (followup.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  
  const fu = followup.rows[0];
  
  // AI classification
  const classification = await classifyFollowupResponse(patient_response, {
    reason: fu.reason,
    urgency: 'ROUTINE',
  });
  
  const requiresEscalation = classification.requires_escalation || classification.classification === 'WORSENING' || classification.classification === 'URGENT_CONCERN';
  
  await db.query(
    `UPDATE followups SET status = $1, patient_response = $2, responded_at = NOW(), response_classification = $3, ai_classification = $4, requires_escalation = $5, escalation_reason = $6
     WHERE id = $7`,
    [requiresEscalation ? 'ESCALATED' : 'RESPONDED', patient_response, classification.classification || 'UNCHANGED', JSON.stringify(classification), requiresEscalation, classification.reason || null, followup_id]
  );
  
  if (requiresEscalation) {
    await db.query(
      `INSERT INTO human_review_tasks (patient_id, followup_id, review_type, priority, title, description, reason, ai_output)
       VALUES ($1, $2, 'FOLLOWUP_ESCALATION', 'URGENT', $3, $4, $5, $6)`,
      [fu.patient_id, followup_id, `Follow-up Escalation: Patient ${fu.patient_id}`, `Patient follow-up response classified as: ${classification.classification}`, classification.reason || 'Patient condition may be worsening', JSON.stringify(classification)]
    );
    
    await auditLogger.logEvent({
      eventType: 'FOLLOWUP_ESCALATED',
      patientId: fu.patient_id,
      appointmentId: fu.appointment_id,
      aiInvolved: true,
      action: `Follow-up response escalated: ${classification.classification}`,
      details: { classification },
    });
  }
  
  await auditLogger.logEvent({
    eventType: 'FOLLOWUP_RESPONDED',
    patientId: fu.patient_id,
    action: `Follow-up response received and classified as ${classification.classification}`,
    aiInvolved: true,
  });
  
  res.json({
    status: requiresEscalation ? 'ESCALATED' : 'RECORDED',
    classification: classification.classification,
    message: requiresEscalation
      ? 'Your response has been flagged for immediate clinical review. A staff member will contact you shortly.'
      : 'Thank you for your update. Your response has been recorded.',
  });
});

// GET /api/followups — List followups
router.get('/', async (req, res) => {
  const { status } = req.query;
  let q = `SELECT f.*, p.first_name, p.last_name FROM followups f LEFT JOIN patients p ON f.patient_id = p.id`;
  const params = [];
  if (status) { q += ` WHERE f.status = $1`; params.push(status); }
  q += ' ORDER BY f.created_at DESC LIMIT 50';
  const result = await db.query(q, params);
  res.json({ followups: result.rows });
});

module.exports = router;
