const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/audit/:patientId
router.get('/:patientId', async (req, res) => {
  const result = await db.query(
    'SELECT * FROM audit_logs WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 200',
    [req.params.patientId]
  );
  res.json({ audit_trail: result.rows });
});

// GET /api/audit — Recent audit events
router.get('/', async (req, res) => {
  const { event_type, limit = 100 } = req.query;
  let q = 'SELECT * FROM audit_logs';
  const params = [];
  if (event_type) {
    params.push(event_type);
    q += ' WHERE event_type = $1';
  }
  q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit));
  const result = await db.query(q, params);
  res.json({ audit_trail: result.rows });
});

module.exports = router;
