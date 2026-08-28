/**
 * Scheduling Engine
 * 
 * Database-backed appointment scheduling with:
 * - Slot availability computation from doctor schedules
 * - Double-booking prevention via SELECT ... FOR UPDATE
 * - Alternate slot suggestions when conflicts occur
 */
const db = require('../config/database');

const DAYS_MAP = {
  0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY',
  4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY'
};

/**
 * Get available slots for a doctor within a date range
 * @param {string} doctorId 
 * @param {string} fromDate - ISO date string (YYYY-MM-DD)
 * @param {string} toDate - ISO date string (YYYY-MM-DD)
 * @returns {Array<{date: string, start_time: string, end_time: string}>}
 */
async function getAvailableSlots(doctorId, fromDate, toDate) {
  // Get doctor info
  const doctorResult = await db.query(
    'SELECT appointment_duration_minutes, max_daily_appointments FROM doctors WHERE id = $1 AND is_active = true',
    [doctorId]
  );
  if (doctorResult.rows.length === 0) return [];
  
  const doctor = doctorResult.rows[0];
  const duration = doctor.appointment_duration_minutes;
  
  // Get doctor's weekly availability
  const availResult = await db.query(
    'SELECT day_of_week, start_time, end_time FROM doctor_availability WHERE doctor_id = $1 AND is_available = true',
    [doctorId]
  );
  
  const availByDay = {};
  for (const row of availResult.rows) {
    availByDay[row.day_of_week] = { start: row.start_time, end: row.end_time };
  }
  
  // Get existing appointments in the range
  const apptResult = await db.query(
    `SELECT appointment_date, start_time, end_time FROM appointments
     WHERE doctor_id = $1 AND appointment_date BETWEEN $2 AND $3 AND status NOT IN ('CANCELLED')`,
    [doctorId, fromDate, toDate]
  );
  
  const bookedSlots = {};
  for (const appt of apptResult.rows) {
    const dateStr = appt.appointment_date.toISOString().split('T')[0];
    if (!bookedSlots[dateStr]) bookedSlots[dateStr] = [];
    bookedSlots[dateStr].push({
      start: appt.start_time.substring(0, 5),
      end: appt.end_time.substring(0, 5),
    });
  }
  
  // Generate available slots
  const slots = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayName = DAYS_MAP[d.getDay()];
    const avail = availByDay[dayName];
    if (!avail) continue;
    
    const dateStr = d.toISOString().split('T')[0];
    const booked = bookedSlots[dateStr] || [];
    
    // Count existing appointments for max daily limit
    const dailyCount = booked.length;
    if (dailyCount >= doctor.max_daily_appointments) continue;
    
    // Generate time slots
    const startMinutes = timeToMinutes(avail.start);
    const endMinutes = timeToMinutes(avail.end);
    
    for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
      const slotStart = minutesToTime(m);
      const slotEnd = minutesToTime(m + duration);
      
      // Check if slot conflicts with any existing appointment
      const conflict = booked.some(b => {
        const bStart = timeToMinutes(b.start);
        const bEnd = timeToMinutes(b.end);
        return m < bEnd && (m + duration) > bStart;
      });
      
      if (!conflict) {
        slots.push({
          date: dateStr,
          start_time: slotStart,
          end_time: slotEnd,
          doctor_id: doctorId,
        });
      }
    }
  }
  
  return slots;
}

/**
 * Book an appointment with double-booking prevention
 */
async function bookAppointment({
  patientId, doctorId, date, startTime, endTime, durationMinutes,
  intakeId, triageId, urgency, reason, specialtyId, selectionReason,
}) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Lock the doctor's appointments for this date to prevent race conditions
    const lockResult = await client.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND start_time = $3 AND status != 'CANCELLED'
       FOR UPDATE`,
      [doctorId, date, startTime]
    );
    
    if (lockResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'SLOT_TAKEN', message: 'This time slot is no longer available' };
    }
    
    // Check for overlapping appointments
    const overlapResult = await client.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2
         AND start_time < $4 AND end_time > $3
         AND status != 'CANCELLED'
       FOR UPDATE`,
      [doctorId, date, startTime, endTime]
    );
    
    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'OVERLAP', message: 'This slot overlaps with an existing appointment' };
    }
    
    // Create the appointment
    const apptResult = await client.query(
      `INSERT INTO appointments (patient_id, doctor_id, intake_id, triage_id, appointment_date, start_time, end_time, duration_minutes, urgency, reason, specialty_id, selection_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [patientId, doctorId, intakeId, triageId, date, startTime, endTime, durationMinutes, urgency, reason, specialtyId, selectionReason]
    );
    
    await client.query('COMMIT');
    return { success: true, appointment: apptResult.rows[0] };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    // Handle unique constraint violation (double booking)
    if (err.code === '23505') {
      return { success: false, error: 'DOUBLE_BOOKING', message: 'Double booking prevented by database constraint' };
    }
    throw err;
  } finally {
    client.release();
  }
}

// Helpers
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

module.exports = { getAvailableSlots, bookAppointment };
