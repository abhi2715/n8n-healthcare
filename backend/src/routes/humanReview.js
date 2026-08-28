const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auditLogger = require('../services/auditLogger');

// GET /api/human-review — List pending reviews
router.get('/', async (req, res) => {
  const { status = 'PENDING', priority } = req.query;
  let q = `SELECT hr.*, p.first_name, p.last_name, p.email
    FROM human_review_tasks hr LEFT JOIN patients p ON hr.patient_id = p.id WHERE hr.status = $1`;
  const params = [status];
  if (priority) { params.push(priority); q += ` AND hr.priority = $${params.length}`; }
  q += ' ORDER BY CASE hr.priority WHEN \'EMERGENCY\' THEN 1 WHEN \'URGENT\' THEN 2 WHEN \'ROUTINE\' THEN 3 ELSE 4 END, hr.created_at ASC';
  const result = await db.query(q, params);
  res.json({ reviews: result.rows });
});

// PATCH /api/human-review/:id — Resolve a review
router.patch('/:id', async (req, res) => {
  const { status, resolution, resolution_notes, reviewed_by } = req.body;
  
  if (!status || !['IN_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  const result = await db.query(
    `UPDATE human_review_tasks SET status = $1, resolution = $2, resolution_notes = $3, reviewed_by = $4, reviewed_at = NOW() WHERE id = $5 RETURNING *`,
    [status, resolution, resolution_notes, reviewed_by || 'admin', req.params.id]
  );
  
  if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  
  await auditLogger.logEvent({
    eventType: 'HUMAN_REVIEW_COMPLETED',
    patientId: result.rows[0].patient_id,
    intakeId: result.rows[0].intake_id,
    action: `Human review ${status} by ${reviewed_by || 'admin'}`,
    details: { resolution, resolution_notes },
  });
  
  res.json({ review: result.rows[0] });
});

module.exports = router;
