const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/doctors
router.get('/', async (req, res) => {
  const { specialty } = req.query;
  let q = `SELECT d.*, s.name as specialty_name,
    (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id AND a.appointment_date >= CURRENT_DATE AND a.status NOT IN ('CANCELLED')) as upcoming_appointments
    FROM doctors d JOIN specialties s ON d.specialty_id = s.id WHERE d.is_active = true`;
  const params = [];
  if (specialty) {
    params.push(specialty);
    q += ` AND s.name = $1`;
  }
  q += ' ORDER BY d.last_name ASC';
  const result = await db.query(q, params);
  res.json({ doctors: result.rows });
});

// GET /api/doctors/:id
router.get('/:id', async (req, res) => {
  const result = await db.query(
    `SELECT d.*, s.name as specialty_name FROM doctors d JOIN specialties s ON d.specialty_id = s.id WHERE d.id = $1`, [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  
  const availability = await db.query('SELECT * FROM doctor_availability WHERE doctor_id = $1 ORDER BY day_of_week', [req.params.id]);
  const appointments = await db.query(
    `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name, t.urgency, t.summary as triage_summary, t.red_flags, t.clinician_review_points
     FROM appointments a LEFT JOIN patients p ON a.patient_id = p.id LEFT JOIN triage_assessments t ON a.triage_id = t.id
     WHERE a.doctor_id = $1 AND a.appointment_date >= CURRENT_DATE AND a.status NOT IN ('CANCELLED')
     ORDER BY a.appointment_date ASC, a.start_time ASC LIMIT 20`, [req.params.id]);
  
  res.json({ doctor: result.rows[0], availability: availability.rows, upcoming_appointments: appointments.rows });
});

module.exports = router;
