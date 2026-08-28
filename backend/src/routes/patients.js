const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { validateUUID } = require('../middleware/validation');

// GET /api/patients — List all patients
router.get('/', async (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  let q = `SELECT p.*, 
    (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id) as appointment_count,
    (SELECT t.urgency FROM triage_assessments t JOIN patient_intake pi ON t.intake_id = pi.id WHERE pi.patient_id = p.id ORDER BY t.created_at DESC LIMIT 1) as latest_urgency
    FROM patients p`;
  const params = [];
  
  if (search) {
    q += ` WHERE (p.first_name ILIKE $1 OR p.last_name ILIKE $1 OR p.email ILIKE $1)`;
    params.push(`%${search}%`);
  }
  
  q += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit), parseInt(offset));
  
  const result = await db.query(q, params);
  const countResult = await db.query('SELECT COUNT(*) FROM patients');
  
  res.json({ patients: result.rows, total: parseInt(countResult.rows[0].count) });
});

// GET /api/patients/:id — Patient detail
router.get('/:id', validateUUID('id'), async (req, res) => {
  const { id } = req.params;
  
  const patient = await db.query('SELECT * FROM patients WHERE id = $1', [id]);
  if (patient.rows.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Patient not found' });
  }
  
  const [history, meds, allergies, intakes, appointments, triages] = await Promise.all([
    db.query('SELECT * FROM medical_history WHERE patient_id = $1 ORDER BY created_at DESC', [id]),
    db.query('SELECT * FROM medications WHERE patient_id = $1 ORDER BY is_current DESC', [id]),
    db.query('SELECT * FROM allergies WHERE patient_id = $1', [id]),
    db.query('SELECT * FROM patient_intake WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10', [id]),
    db.query(`SELECT a.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name, s.name as specialty_name
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      WHERE a.patient_id = $1 ORDER BY a.appointment_date DESC LIMIT 20`, [id]),
    db.query('SELECT * FROM triage_assessments WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5', [id]),
  ]);
  
  res.json({
    patient: patient.rows[0],
    medical_history: history.rows,
    medications: meds.rows,
    allergies: allergies.rows,
    intakes: intakes.rows,
    appointments: appointments.rows,
    triage_assessments: triages.rows,
  });
});

module.exports = router;
