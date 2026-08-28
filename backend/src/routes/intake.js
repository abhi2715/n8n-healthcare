/**
 * Patient Intake Route
 * POST /api/intake — Full patient intake + triage + scheduling pipeline
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { validateIntakeInput } = require('../middleware/validation');
const { performTriage } = require('../services/aiTriage');
const { evaluateSafety, quickSafetyScan } = require('../services/safetyEngine');
const { findBestDoctor } = require('../services/doctorMatching');
const { bookAppointment } = require('../services/scheduling');
const { sendIntakeConfirmation, sendAppointmentConfirmation, notifyDoctorAssignment, sendEmergencyAlert } = require('../services/notification');
const auditLogger = require('../services/auditLogger');

router.post('/', validateIntakeInput, async (req, res) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  const idempotencyKey = req.headers['x-idempotency-key'] || null;
  
  try {
    // 1. Idempotency check
    if (idempotencyKey) {
      const existing = await db.query(
        'SELECT id, status, patient_id FROM patient_intake WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return res.status(200).json({
          message: 'Intake already processed (idempotent)',
          intake_id: existing.rows[0].id,
          status: existing.rows[0].status,
          patient_id: existing.rows[0].patient_id,
        });
      }
    }
    
    const body = req.body;
    
    // 2. Create intake record
    const intakeResult = await db.query(
      `INSERT INTO patient_intake (idempotency_key, full_name, date_of_birth, age, email, phone, symptoms, symptom_duration, severity, existing_conditions, current_medications, allergies, preferred_appointment_time, preferred_communication, correlation_id, raw_payload, processing_started_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), 'VALIDATING')
       RETURNING *`,
      [idempotencyKey, body.full_name, body.date_of_birth, body.age ? parseInt(body.age) : null, body.email, body.phone, body.symptoms, body.symptom_duration, body.severity || 'MILD', body.existing_conditions, body.current_medications, body.allergies, body.preferred_appointment_time, body.preferred_communication || 'email', correlationId, JSON.stringify(body)]
    );
    const intake = intakeResult.rows[0];
    
    await auditLogger.logEvent({
      eventType: 'INTAKE_CREATED',
      correlationId,
      intakeId: intake.id,
      action: 'Patient intake form received',
      details: { full_name: body.full_name, severity: body.severity },
    });
    
    // 3. Quick safety pre-scan
    const quickScan = quickSafetyScan(body.symptoms);
    
    // 4. Find or create patient
    let patient;
    const existingPatient = await db.query(
      'SELECT * FROM patients WHERE email = $1',
      [body.email]
    );
    
    if (existingPatient.rows.length > 0) {
      patient = existingPatient.rows[0];
      // Update intake with patient link
      await db.query('UPDATE patient_intake SET patient_id = $1 WHERE id = $2', [patient.id, intake.id]);
    } else {
      const nameParts = body.full_name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || nameParts[0];
      
      const newPatient = await db.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, age, email, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [firstName, lastName, body.date_of_birth || null, body.age ? parseInt(body.age) : null, body.email, body.phone]
      );
      patient = newPatient.rows[0];
      await db.query('UPDATE patient_intake SET patient_id = $1 WHERE id = $2', [patient.id, intake.id]);
      
      await auditLogger.logEvent({
        eventType: 'PATIENT_CREATED',
        correlationId,
        patientId: patient.id,
        intakeId: intake.id,
        action: 'New patient record created',
      });
    }
    
    // Store medical background if provided
    if (body.existing_conditions) {
      const conditions = body.existing_conditions.split(',').map(c => c.trim()).filter(c => c);
      for (const cond of conditions) {
        await db.query(
          'INSERT INTO medical_history (patient_id, condition_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [patient.id, cond]
        ).catch(() => {}); // Ignore duplicates
      }
    }
    
    if (body.allergies) {
      const allergyList = body.allergies.split(',').map(a => a.trim()).filter(a => a);
      for (const allergen of allergyList) {
        await db.query(
          'INSERT INTO allergies (patient_id, allergen) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [patient.id, allergen]
        ).catch(() => {});
      }
    }
    
    // 5. Send intake confirmation notification
    await sendIntakeConfirmation(patient, intake).catch(err => {
      console.error('[INTAKE] Notification failed:', err.message);
    });
    
    // 6. AI Triage
    await db.query("UPDATE patient_intake SET status = 'PROCESSING' WHERE id = $1", [intake.id]);
    
    const triageResult = await performTriage({
      ...intake,
      patient_id: patient.id,
    });
    
    const triage = triageResult.triage;
    
    // 7. Deterministic Safety Evaluation
    const safetyResult = evaluateSafety({
      symptoms: body.symptoms,
      triageResult: triage,
    });
    
    // Merge quick scan results
    if (quickScan.has_emergency_indicators) {
      safetyResult.triggered_rules.push(...quickScan.triggered_rules.filter(
        qr => !safetyResult.triggered_rules.some(sr => sr.description === qr.description)
      ));
      if (!safetyResult.is_emergency) {
        safetyResult.is_emergency = true;
        safetyResult.final_urgency = 'EMERGENCY';
        safetyResult.deterministic_override = true;
        safetyResult.requires_human_review = true;
        safetyResult.passed = false;
      }
    }
    
    // 8. Store triage assessment
    const specialtyResult = await db.query('SELECT id FROM specialties WHERE name = $1', [triage.specialty]);
    const specialtyId = specialtyResult.rows[0]?.id || null;
    
    const triageRecord = await db.query(
      `INSERT INTO triage_assessments (intake_id, patient_id, urgency, risk_score, specialty_recommended, specialty_id, red_flags, summary, clinician_review_points, recommended_next_step, confidence, requires_human_review, ai_model, ai_raw_output, ai_prompt_tokens, ai_completion_tokens, ai_latency_ms, ai_retry_count, safety_evaluation_passed, safety_rules_triggered, deterministic_override, output_validation_passed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [intake.id, patient.id, safetyResult.final_urgency, triage.risk_score, triage.specialty, specialtyId, JSON.stringify(triage.red_flags), triage.summary, JSON.stringify(triage.clinician_review_points), triage.recommended_next_step, triage.confidence, safetyResult.requires_human_review, triage.ai_model, JSON.stringify(triage.ai_raw_output), triage.ai_prompt_tokens, triage.ai_completion_tokens, triage.ai_latency_ms, triage.ai_retry_count, safetyResult.passed, JSON.stringify(safetyResult.triggered_rules), safetyResult.deterministic_override, triageResult.success]
    );
    
    await auditLogger.logEvent({
      eventType: safetyResult.is_emergency ? 'SAFETY_RULE_TRIGGERED' : 'TRIAGE_COMPLETED',
      correlationId,
      patientId: patient.id,
      intakeId: intake.id,
      aiInvolved: true,
      action: safetyResult.is_emergency
        ? `Emergency detected — ${safetyResult.triggered_rules.length} safety rule(s) triggered`
        : `Triage completed: ${safetyResult.final_urgency}`,
      details: {
        urgency: safetyResult.final_urgency,
        risk_score: triage.risk_score,
        safety_passed: safetyResult.passed,
        deterministic_override: safetyResult.deterministic_override,
        triggered_rules_count: safetyResult.triggered_rules.length,
      },
    });
    
    // 9. Handle EMERGENCY path
    if (safetyResult.is_emergency) {
      // Create human review task
      await db.query(
        `INSERT INTO human_review_tasks (patient_id, intake_id, triage_id, review_type, priority, title, description, reason, ai_output, safety_flags)
         VALUES ($1, $2, $3, 'EMERGENCY_TRIAGE', 'EMERGENCY', $4, $5, $6, $7, $8)`,
        [patient.id, intake.id, triageRecord.rows[0].id, `🚨 EMERGENCY: ${patient.first_name} ${patient.last_name}`, `Emergency indicators detected for patient ${body.full_name}. Symptoms: ${body.symptoms.substring(0, 500)}`, `Safety rules triggered: ${safetyResult.triggered_rules.map(r => r.description).join('; ')}`, JSON.stringify(triage), JSON.stringify(safetyResult.triggered_rules)]
      );
      
      await sendEmergencyAlert(patient, intake, safetyResult).catch(err => {
        console.error('[INTAKE] Emergency notification failed:', err.message);
      });
      
      await auditLogger.logEvent({
        eventType: 'EMERGENCY_ESCALATED',
        correlationId,
        patientId: patient.id,
        intakeId: intake.id,
        action: 'Emergency case escalated to human review — normal scheduling bypassed',
        details: { triggered_rules: safetyResult.triggered_rules },
      });
      
      await db.query("UPDATE patient_intake SET status = 'ESCALATED', processing_completed_at = NOW() WHERE id = $1", [intake.id]);
      
      return res.status(200).json({
        status: 'ESCALATED',
        message: 'Emergency indicators detected. This case has been immediately escalated to clinical staff for review. Normal scheduling has been bypassed.',
        intake_id: intake.id,
        patient_id: patient.id,
        urgency: 'EMERGENCY',
        safety_evaluation: {
          is_emergency: true,
          triggered_rules: safetyResult.triggered_rules.map(r => r.description),
          deterministic_override: safetyResult.deterministic_override,
        },
        disclaimer: 'DEMO: This is a synthetic emergency notification. In a real emergency, call your local emergency services immediately.',
        correlation_id: correlationId,
        processing_time_ms: Date.now() - startTime,
      });
    }
    
    // 10. Normal path — Doctor matching
    const matchResult = await findBestDoctor({
      specialtyName: triage.specialty,
      urgency: safetyResult.final_urgency,
      preferredDate: body.preferred_appointment_time,
    });
    
    if (matchResult.error) {
      // No doctor or no availability — create human review task
      await db.query(
        `INSERT INTO human_review_tasks (patient_id, intake_id, triage_id, review_type, priority, title, description, reason)
         VALUES ($1, $2, $3, 'SCHEDULING_FAILURE', $4, $5, $6, $7)`,
        [patient.id, intake.id, triageRecord.rows[0].id, safetyResult.final_urgency, `Scheduling failed: ${patient.first_name} ${patient.last_name}`, `Could not find available doctor/slot for ${triage.specialty}`, matchResult.message]
      );
      
      await auditLogger.logEvent({
        eventType: 'WORKFLOW_FAILURE',
        correlationId,
        patientId: patient.id,
        intakeId: intake.id,
        action: `Doctor matching failed: ${matchResult.message}`,
        result: 'error',
      });
      
      await db.query("UPDATE patient_intake SET status = 'FAILED', error_message = $2, processing_completed_at = NOW() WHERE id = $1", [intake.id, matchResult.message]);
      
      return res.status(200).json({
        status: 'SCHEDULING_PENDING',
        message: 'Triage completed but no immediate appointment slot available. Staff will follow up with scheduling options.',
        intake_id: intake.id,
        patient_id: patient.id,
        urgency: safetyResult.final_urgency,
        triage_summary: triage.summary,
        error: matchResult.message,
        correlation_id: correlationId,
      });
    }
    
    // 11. Book appointment
    const slot = matchResult.slots[0];
    const bookResult = await bookAppointment({
      patientId: patient.id,
      doctorId: matchResult.doctor.id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      durationMinutes: matchResult.doctor.appointment_duration_minutes,
      intakeId: intake.id,
      triageId: triageRecord.rows[0].id,
      urgency: safetyResult.final_urgency,
      reason: body.symptoms.substring(0, 500),
      specialtyId: matchResult.specialty_id,
      selectionReason: matchResult.selectionReason,
    });
    
    if (!bookResult.success) {
      // Try alternate slot
      if (matchResult.slots.length > 1) {
        const altSlot = matchResult.slots[1];
        const altBook = await bookAppointment({
          patientId: patient.id,
          doctorId: matchResult.doctor.id,
          date: altSlot.date,
          startTime: altSlot.start_time,
          endTime: altSlot.end_time,
          durationMinutes: matchResult.doctor.appointment_duration_minutes,
          intakeId: intake.id,
          triageId: triageRecord.rows[0].id,
          urgency: safetyResult.final_urgency,
          reason: body.symptoms.substring(0, 500),
          specialtyId: matchResult.specialty_id,
          selectionReason: matchResult.selectionReason + ' (alternate slot)',
        });
        
        if (altBook.success) {
          bookResult.success = true;
          bookResult.appointment = altBook.appointment;
        }
      }
    }
    
    if (!bookResult.success) {
      await db.query("UPDATE patient_intake SET status = 'FAILED', error_message = $2, processing_completed_at = NOW() WHERE id = $1", [intake.id, bookResult.message]);
      
      return res.status(200).json({
        status: 'SCHEDULING_FAILED',
        message: bookResult.message,
        intake_id: intake.id,
        patient_id: patient.id,
        alternate_slots: matchResult.slots.slice(1),
        correlation_id: correlationId,
      });
    }
    
    const appointment = bookResult.appointment;
    
    await auditLogger.logEvent({
      eventType: 'APPOINTMENT_CREATED',
      correlationId,
      patientId: patient.id,
      intakeId: intake.id,
      appointmentId: appointment.id,
      doctorId: matchResult.doctor.id,
      action: `Appointment scheduled with Dr. ${matchResult.doctor.last_name} on ${slot.date} at ${slot.start_time}`,
      details: { selection_reason: matchResult.selectionReason },
    });
    
    // 12. Notifications
    await sendAppointmentConfirmation(patient, appointment, matchResult.doctor).catch(err => {
      console.error('[INTAKE] Appointment notification failed:', err.message);
    });
    
    await notifyDoctorAssignment(matchResult.doctor, patient, appointment, triage).catch(err => {
      console.error('[INTAKE] Doctor notification failed:', err.message);
    });
    
    // 13. Create follow-up task (scheduled for 1 day after appointment)
    const followupDate = new Date(appointment.appointment_date);
    followupDate.setDate(followupDate.getDate() + 1);
    
    await db.query(
      `INSERT INTO followups (patient_id, appointment_id, intake_id, scheduled_date, followup_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [patient.id, appointment.id, intake.id, followupDate.toISOString(), `Dear ${patient.first_name}, we hope your appointment with Dr. ${matchResult.doctor.last_name} went well. How are you feeling? Please reply with a brief update on your condition.`]
    );
    
    // 14. Update intake status
    await db.query("UPDATE patient_intake SET status = 'SCHEDULED', processing_completed_at = NOW() WHERE id = $1", [intake.id]);
    
    // 15. Human review task if required
    if (safetyResult.requires_human_review) {
      await db.query(
        `INSERT INTO human_review_tasks (patient_id, intake_id, triage_id, appointment_id, review_type, priority, title, description, reason, ai_output)
         VALUES ($1, $2, $3, $4, 'TRIAGE_REVIEW', $5, $6, $7, $8, $9)`,
        [patient.id, intake.id, triageRecord.rows[0].id, appointment.id, safetyResult.final_urgency, `Review: ${patient.first_name} ${patient.last_name} — ${safetyResult.final_urgency}`, `AI triage flagged for clinician review. Urgency: ${safetyResult.final_urgency}, Risk: ${triage.risk_score}`, `Confidence: ${triage.confidence}, Red flags: ${triage.red_flags.join(', ') || 'none'}`, JSON.stringify(triage)]
      );
      
      await auditLogger.logEvent({
        eventType: 'HUMAN_REVIEW_REQUIRED',
        correlationId,
        patientId: patient.id,
        intakeId: intake.id,
        action: 'Triage result flagged for human review',
        details: { reason: 'AI confidence or urgency level requires clinician review' },
      });
    }
    
    const processingTime = Date.now() - startTime;
    
    return res.status(201).json({
      status: 'SCHEDULED',
      message: 'Intake processed and appointment scheduled successfully',
      intake_id: intake.id,
      patient_id: patient.id,
      triage: {
        urgency: safetyResult.final_urgency,
        risk_score: triage.risk_score,
        specialty: triage.specialty,
        summary: triage.summary,
        requires_human_review: safetyResult.requires_human_review,
        ai_disclaimer: '⚠️ AI-GENERATED: This triage assessment is for administrative routing only and requires clinician review.',
      },
      appointment: {
        id: appointment.id,
        doctor: `Dr. ${matchResult.doctor.first_name} ${matchResult.doctor.last_name}`,
        specialty: triage.specialty,
        date: appointment.appointment_date,
        time: appointment.start_time,
        location: matchResult.doctor.location,
        duration_minutes: appointment.duration_minutes,
      },
      safety_evaluation: {
        passed: safetyResult.passed,
        deterministic_override: safetyResult.deterministic_override,
        triggered_rules_count: safetyResult.triggered_rules.length,
      },
      correlation_id: correlationId,
      processing_time_ms: processingTime,
    });
    
  } catch (err) {
    console.error('[INTAKE] Error:', err);
    
    await auditLogger.logEvent({
      eventType: 'WORKFLOW_FAILURE',
      correlationId,
      action: 'Patient intake pipeline failed',
      result: 'error',
      errorMessage: err.message,
      durationMs: Date.now() - startTime,
    });
    
    return res.status(500).json({
      error: 'INTAKE_FAILED',
      message: 'An error occurred processing the intake. Our team has been notified.',
      correlation_id: correlationId,
    });
  }
});

module.exports = router;
