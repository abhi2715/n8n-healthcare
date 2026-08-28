/**
 * Mock Notification Service
 * 
 * All notifications are logged to the database for dashboard visibility.
 * In production, this would integrate with real email/SMS/Slack providers.
 */
const db = require('../config/database');
const auditLogger = require('./auditLogger');

/**
 * Send a notification (mock — logs to DB)
 */
async function sendNotification({
  recipientType,
  recipientId,
  recipientEmail,
  notificationType = 'EMAIL',
  subject,
  body,
  template,
  patientId,
  appointmentId,
  intakeId,
}) {
  try {
    const result = await db.query(
      `INSERT INTO notifications (recipient_type, recipient_id, recipient_email, notification_type, status, subject, body, template, patient_id, appointment_id, intake_id, sent_at)
       VALUES ($1, $2, $3, $4, 'SENT', $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [recipientType, recipientId, recipientEmail, notificationType, subject, body, template, patientId, appointmentId, intakeId]
    );
    
    const notification = result.rows[0];
    
    console.log(`[NOTIFICATION] ${notificationType} → ${recipientType} (${recipientEmail || recipientId}): ${subject}`);
    
    await auditLogger.logEvent({
      eventType: 'NOTIFICATION_SENT',
      patientId,
      appointmentId,
      intakeId,
      action: `${notificationType} notification sent to ${recipientType}`,
      details: { notification_id: notification.id, subject, template, recipient_email: recipientEmail },
    });
    
    return notification;
  } catch (err) {
    console.error('[NOTIFICATION] Failed:', err.message);
    
    // Log failed notification
    try {
      await db.query(
        `INSERT INTO notifications (recipient_type, recipient_id, recipient_email, notification_type, status, subject, body, template, patient_id, appointment_id, intake_id, failed_at, error_message)
         VALUES ($1, $2, $3, $4, 'FAILED', $5, $6, $7, $8, $9, $10, NOW(), $11)`,
        [recipientType, recipientId, recipientEmail, notificationType, subject, body, template, patientId, appointmentId, intakeId, err.message]
      );
    } catch (logErr) {
      console.error('[NOTIFICATION] Failed to log failure:', logErr.message);
    }
    
    throw err;
  }
}

/**
 * Send intake confirmation to patient
 */
async function sendIntakeConfirmation(patient, intake) {
  return sendNotification({
    recipientType: 'patient',
    recipientId: patient.id,
    recipientEmail: patient.email,
    subject: 'Your intake form has been received',
    body: `Dear ${patient.first_name},\n\nThank you for submitting your intake form. Our team is reviewing your information and will get back to you shortly with appointment details.\n\nReference: ${intake.id}\n\nBest regards,\nHealthcare AI Demo Platform\n\n⚠️ DEMO: This is a synthetic notification from a portfolio project.`,
    template: 'intake_confirmation',
    patientId: patient.id,
    intakeId: intake.id,
  });
}

/**
 * Send appointment confirmation to patient
 */
async function sendAppointmentConfirmation(patient, appointment, doctor) {
  return sendNotification({
    recipientType: 'patient',
    recipientId: patient.id,
    recipientEmail: patient.email,
    subject: `Appointment Confirmed — ${appointment.appointment_date} at ${appointment.start_time}`,
    body: `Dear ${patient.first_name},\n\nYour appointment has been scheduled:\n\nDoctor: Dr. ${doctor.last_name}\nDate: ${appointment.appointment_date}\nTime: ${appointment.start_time}\nLocation: ${doctor.location}\nDuration: ${appointment.duration_minutes} minutes\n\nPlease arrive 10 minutes early.\n\nBest regards,\nHealthcare AI Demo Platform\n\n⚠️ DEMO: This is a synthetic notification.`,
    template: 'appointment_confirmation',
    patientId: patient.id,
    appointmentId: appointment.id,
  });
}

/**
 * Notify doctor of new patient assignment
 */
async function notifyDoctorAssignment(doctor, patient, appointment, triage) {
  const urgencyEmoji = { EMERGENCY: '🚨', URGENT: '⚡', ROUTINE: '📋', NON_URGENT: '📝' };
  const emoji = urgencyEmoji[triage?.urgency] || '📋';
  
  return sendNotification({
    recipientType: 'doctor',
    recipientId: doctor.id,
    recipientEmail: doctor.email,
    subject: `${emoji} New Patient: ${patient.first_name} ${patient.last_name} — ${triage?.urgency || 'ROUTINE'}`,
    body: `Dr. ${doctor.last_name},\n\nA new patient has been assigned to you:\n\nPatient: ${patient.first_name} ${patient.last_name}\nDate: ${appointment.appointment_date}\nTime: ${appointment.start_time}\nUrgency: ${triage?.urgency || 'ROUTINE'}\n\n⚠️ AI-GENERATED TRIAGE SUMMARY (requires clinician review):\n${triage?.summary || 'No triage summary available.'}\n\nRed Flags: ${(triage?.red_flags || []).join(', ') || 'None identified'}\n\nBest regards,\nHealthcare AI Demo Platform`,
    template: 'doctor_assignment',
    patientId: patient.id,
    appointmentId: appointment.id,
    intakeId: triage?.intake_id,
  });
}

/**
 * Send emergency notification to admin staff
 */
async function sendEmergencyAlert(patient, intake, safetyResult) {
  return sendNotification({
    recipientType: 'admin',
    recipientId: null,
    recipientEmail: 'admin@healthcaredemo.local',
    notificationType: 'IN_APP',
    subject: `🚨 EMERGENCY ESCALATION — Patient: ${patient?.first_name || 'Unknown'} ${patient?.last_name || ''}`,
    body: `EMERGENCY CASE DETECTED\n\nPatient: ${patient?.first_name || 'Unknown'} ${patient?.last_name || ''}\nTriggered Rules:\n${safetyResult.triggered_rules.map(r => `  - [${r.category}] ${r.description}`).join('\n')}\n\nImmediate human review required.\nNormal scheduling has been bypassed.\n\n⚠️ DEMO: This is a synthetic emergency notification. In a real system, this would trigger immediate clinical staff response.`,
    template: 'emergency_alert',
    patientId: patient?.id,
    intakeId: intake?.id,
  });
}

module.exports = {
  sendNotification,
  sendIntakeConfirmation,
  sendAppointmentConfirmation,
  notifyDoctorAssignment,
  sendEmergencyAlert,
};
