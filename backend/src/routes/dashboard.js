const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const [
      totalPatients, todayAppointments, emergencyCases, urgentCases, routineCases,
      pendingReviews, pendingFollowups, completedAppointments, noShows,
      triageDistribution, specialtyDistribution, recentIntakes, recentAudit
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM patients'),
      db.query("SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE AND status != 'CANCELLED'"),
      db.query("SELECT COUNT(*) FROM triage_assessments WHERE urgency = 'EMERGENCY'"),
      db.query("SELECT COUNT(*) FROM triage_assessments WHERE urgency = 'URGENT'"),
      db.query("SELECT COUNT(*) FROM triage_assessments WHERE urgency = 'ROUTINE'"),
      db.query("SELECT COUNT(*) FROM human_review_tasks WHERE status = 'PENDING'"),
      db.query("SELECT COUNT(*) FROM followups WHERE status IN ('PENDING', 'SENT')"),
      db.query("SELECT COUNT(*) FROM appointments WHERE status = 'COMPLETED'"),
      db.query("SELECT COUNT(*) FROM appointments WHERE status = 'NO_SHOW'"),
      db.query("SELECT urgency, COUNT(*) as count FROM triage_assessments GROUP BY urgency ORDER BY urgency"),
      db.query("SELECT s.name, COUNT(a.id) as count FROM appointments a JOIN specialties s ON a.specialty_id = s.id GROUP BY s.name ORDER BY count DESC"),
      db.query("SELECT pi.*, p.first_name, p.last_name FROM patient_intake pi LEFT JOIN patients p ON pi.patient_id = p.id ORDER BY pi.created_at DESC LIMIT 10"),
      db.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20"),
    ]);
    
    const totalAppts = parseInt(completedAppointments.rows[0].count) + parseInt(noShows.rows[0].count);
    
    res.json({
      stats: {
        total_patients: parseInt(totalPatients.rows[0].count),
        today_appointments: parseInt(todayAppointments.rows[0].count),
        emergency_cases: parseInt(emergencyCases.rows[0].count),
        urgent_cases: parseInt(urgentCases.rows[0].count),
        routine_cases: parseInt(routineCases.rows[0].count),
        pending_reviews: parseInt(pendingReviews.rows[0].count),
        pending_followups: parseInt(pendingFollowups.rows[0].count),
        completed_appointments: parseInt(completedAppointments.rows[0].count),
        no_shows: parseInt(noShows.rows[0].count),
        completion_rate: totalAppts > 0 ? Math.round((parseInt(completedAppointments.rows[0].count) / totalAppts) * 100) : 0,
        no_show_rate: totalAppts > 0 ? Math.round((parseInt(noShows.rows[0].count) / totalAppts) * 100) : 0,
      },
      triage_distribution: triageDistribution.rows,
      specialty_distribution: specialtyDistribution.rows,
      recent_intakes: recentIntakes.rows,
      recent_audit: recentAudit.rows,
    });
  } catch (err) {
    console.error('[DASHBOARD] Error:', err.message);
    res.status(500).json({ error: 'DASHBOARD_ERROR', message: err.message });
  }
});

module.exports = router;
