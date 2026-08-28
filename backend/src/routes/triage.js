const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM triage_assessments WHERE id = $1 OR intake_id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ triage: result.rows[0] });
});

module.exports = router;
