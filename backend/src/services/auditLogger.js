/**
 * Audit Logger Service
 * Logs all major workflow events to the audit_logs table.
 */
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Log an audit event
 */
async function logEvent({
  eventType,
  correlationId,
  workflowExecutionId,
  patientId,
  intakeId,
  appointmentId,
  doctorId,
  actor = 'system',
  aiInvolved = false,
  action,
  result = 'success',
  details = {},
  errorMessage,
  durationMs,
  ipAddress,
}) {
  try {
    await db.query(
      `INSERT INTO audit_logs (event_type, correlation_id, workflow_execution_id, patient_id, intake_id, appointment_id, doctor_id, actor, ai_involved, action, result, details, error_message, duration_ms, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [eventType, correlationId, workflowExecutionId, patientId, intakeId, appointmentId, doctorId, actor, aiInvolved, action, result, JSON.stringify(details), errorMessage, durationMs, ipAddress]
    );
  } catch (err) {
    // Audit logging should never crash the main flow
    console.error('[AUDIT] Failed to log event:', err.message, { eventType, action });
  }
}

/**
 * Get audit trail for a patient
 */
async function getPatientAuditTrail(patientId, limit = 100) {
  const result = await db.query(
    `SELECT * FROM audit_logs WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [patientId, limit]
  );
  return result.rows;
}

/**
 * Get recent audit events
 */
async function getRecentEvents(limit = 50, eventType) {
  let q = 'SELECT * FROM audit_logs';
  const params = [];
  if (eventType) {
    q += ' WHERE event_type = $1';
    params.push(eventType);
  }
  q += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  const result = await db.query(q, params);
  return result.rows;
}

module.exports = { logEvent, getPatientAuditTrail, getRecentEvents };
