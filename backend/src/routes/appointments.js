const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { validateUUID } = require('../middleware/validation');
const { getAvailableSlots, bookAppointment } = require('../services/scheduling');
const { generateDoctorBrief } = require('../services/aiTriage');
const auditLogger = require('../services/auditLogger');

// GET /api/appointments — List appointments
router.get('/', async (req, res) => {
  const { status, doctor_id, date, limit = 50, offset = 0 } = req.query;
  let q = `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name, p.email as patient_email,
    d.first_name as doctor_first_name, d.last_name as doctor_last_name, s.name as specialty_name
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN specialties s ON a.specialty_id = s.id
    WHERE 1=1`;
  const params = [];
  
  if (status) {
    params.push(status);
    q += ` AND a.status = $${params.length}`;
  }
  if (doctor_id) {
    params.push(doctor_id);
    q += ` AND a.doctor_id = $${params.length}`;
  }
  if (date) {
    params.push(date);
    q += ` AND a.appointment_date = $${params.length}`;
  }
  
  q += ` ORDER BY a.appointment_date DESC, a.start_time ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit), parseInt(offset));
  
  const result = await db.query(q, params);
  res.json({ appointments: result.rows });
});

// GET /api/appointments/:id — Appointment detail with doctor brief
router.get('/:id', validateUUID('id'), async (req, res) => {
  const result = await db.query(
    `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
      p.email as patient_email, p.phone as patient_phone, p.age as patient_age, p.gender as patient_gender,
      d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.email as doctor_email, d.location as doctor_location,
      s.name as specialty_name
     FROM appointments a
     LEFT JOIN patients p ON a.patient_id = p.id
     LEFT JOIN doctors d ON a.doctor_id = d.id
     LEFT JOIN specialties s ON a.specialty_id = s.id
     WHERE a.id = $1`, [req.params.id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  
  const appointment = result.rows[0];
  
  // Get triage info if available
  let triage = null;
  if (appointment.triage_id) {
    const triageResult = await db.query('SELECT * FROM triage_assessments WHERE id = $1', [appointment.triage_id]);
    triage = triageResult.rows[0] || null;
  }
  
  res.json({ appointment, triage });
});

// PATCH /api/appointments/:id — Update appointment status
router.patch('/:id', validateUUID('id'), async (req, res) => {
  const { status, notes, cancellation_reason } = req.body;
  const validStatuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
  
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }
  
  const updates = [];
  const params = [req.params.id];
  
  if (status) {
    params.push(status);
    updates.push(`status = $${params.length}`);
  }
  if (notes) {
    params.push(notes);
    updates.push(`notes = $${params.length}`);
  }
  if (cancellation_reason) {
    params.push(cancellation_reason);
    updates.push(`cancellation_reason = $${params.length}`);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'NO_UPDATES' });
  }
  
  const result = await db.query(
    `UPDATE appointments SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  
  await auditLogger.logEvent({
    eventType: status === 'COMPLETED' ? 'APPOINTMENT_COMPLETED' : 'APPOINTMENT_UPDATED',
    appointmentId: req.params.id,
    patientId: result.rows[0].patient_id,
    doctorId: result.rows[0].doctor_id,
    action: `Appointment status updated to ${status}`,
  });
  
  res.json({ appointment: result.rows[0] });
});

// POST /api/appointments/:id/brief — Generate doctor preparation brief
router.post('/:id/brief', validateUUID('id'), async (req, res) => {
  const apptResult = await db.query(
    `SELECT a.*, p.first_name, p.last_name, p.age, p.gender
     FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.id = $1`, [req.params.id]);
  
  if (apptResult.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  
  const appt = apptResult.rows[0];
  const intakeResult = await db.query('SELECT * FROM patient_intake WHERE id = $1', [appt.intake_id]);
  const triageResult = await db.query('SELECT * FROM triage_assessments WHERE id = $1', [appt.triage_id]);
  
  const briefResult = await generateDoctorBrief(
    appt, intakeResult.rows[0] || {}, triageResult.rows[0] || {}, appt
  );
  
  // Store brief on appointment
  await db.query('UPDATE appointments SET doctor_brief = $1, doctor_brief_generated = true WHERE id = $2',
    [JSON.stringify(briefResult.brief), req.params.id]);
  
  res.json({ brief: briefResult.brief, ai_generated: true, disclaimer: '⚠️ AI-GENERATED: Requires clinician review.' });
});

// GET /api/appointments/slots/:doctorId — Get available slots
router.get('/slots/:doctorId', validateUUID('doctorId'), async (req, res) => {
  const { from, to } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const fromDate = from || today;
  const toDate = to || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  
  const slots = await getAvailableSlots(req.params.doctorId, fromDate, toDate);
  res.json({ slots, doctor_id: req.params.doctorId, from: fromDate, to: toDate });
});

module.exports = router;
