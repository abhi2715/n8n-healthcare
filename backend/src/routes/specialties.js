const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  const result = await db.query('SELECT * FROM specialties WHERE is_active = true ORDER BY name');
  res.json({ specialties: result.rows });
});

module.exports = router;
