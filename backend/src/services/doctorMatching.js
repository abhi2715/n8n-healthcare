/**
 * Doctor Matching Service
 * 
 * Deterministic algorithm that matches patients to doctors based on:
 * - Specialty match (required)
 * - Availability (required)
 * - Workload (prefer balanced load)
 * - Urgency (emergency/urgent get priority scheduling)
 */
const db = require('../config/database');
const scheduling = require('./scheduling');

/**
 * Find the best matching doctor for a patient
 * @param {object} params
 * @param {string} params.specialtyName - Required specialty
 * @param {string} params.urgency - EMERGENCY | URGENT | ROUTINE | NON_URGENT
 * @param {string} [params.preferredDate] - Patient's preferred date
 * @returns {{ doctor: object, slots: Array, selectionReason: string } | null}
 */
async function findBestDoctor({ specialtyName, urgency = 'ROUTINE', preferredDate }) {
  // 1. Find the specialty
  const specResult = await db.query(
    'SELECT id FROM specialties WHERE name = $1 AND is_active = true',
    [specialtyName]
  );
  
  if (specResult.rows.length === 0) {
    return { error: 'SPECIALTY_NOT_FOUND', message: `Specialty "${specialtyName}" not found in database` };
  }
  
  const specialtyId = specResult.rows[0].id;
  
  // 2. Find active doctors in this specialty
  const doctorResult = await db.query(
    `SELECT d.*, s.name as specialty_name,
      (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id AND a.appointment_date >= CURRENT_DATE AND a.status NOT IN ('CANCELLED', 'COMPLETED')) as upcoming_count
     FROM doctors d
     JOIN specialties s ON d.specialty_id = s.id
     WHERE d.specialty_id = $1 AND d.is_active = true
     ORDER BY upcoming_count ASC`,
    [specialtyId]
  );
  
  if (doctorResult.rows.length === 0) {
    return { error: 'NO_DOCTORS', message: `No active doctors found for specialty "${specialtyName}"` };
  }
  
  // 3. Determine search window based on urgency
  const today = new Date();
  let searchDays;
  switch (urgency) {
    case 'EMERGENCY':
      searchDays = 1; // Same day / next day
      break;
    case 'URGENT':
      searchDays = 3;
      break;
    case 'ROUTINE':
      searchDays = 14;
      break;
    default:
      searchDays = 30;
  }
  
  const fromDate = today.toISOString().split('T')[0];
  const toDate = new Date(today.getTime() + searchDays * 86400000).toISOString().split('T')[0];
  
  // 4. Score each doctor
  const candidates = [];
  
  for (const doctor of doctorResult.rows) {
    const slots = await scheduling.getAvailableSlots(doctor.id, fromDate, toDate);
    
    if (slots.length === 0) continue;
    
    let score = 0;
    const reasons = [];
    
    // Workload score (lower upcoming count = higher score)
    const workloadScore = Math.max(0, 10 - parseInt(doctor.upcoming_count));
    score += workloadScore;
    reasons.push(`Workload: ${doctor.upcoming_count} upcoming appointments`);
    
    // Availability score (more slots = better)
    const availScore = Math.min(slots.length, 10);
    score += availScore;
    reasons.push(`Availability: ${slots.length} open slots`);
    
    // Preferred date bonus
    if (preferredDate) {
      const hasPreferred = slots.some(s => s.date === preferredDate);
      if (hasPreferred) {
        score += 5;
        reasons.push('Has preferred date available');
      }
    }
    
    // Urgency bonus (first available slot sooner = better for urgent)
    if (urgency === 'URGENT' || urgency === 'EMERGENCY') {
      const firstSlotDate = new Date(slots[0].date);
      const daysToFirst = Math.ceil((firstSlotDate - today) / 86400000);
      const urgencyScore = Math.max(0, 5 - daysToFirst);
      score += urgencyScore;
      reasons.push(`First available in ${daysToFirst} day(s)`);
    }
    
    candidates.push({
      doctor,
      slots: slots.slice(0, 5), // Return top 5 slots
      score,
      selectionReason: reasons.join('; '),
    });
  }
  
  if (candidates.length === 0) {
    return { error: 'NO_AVAILABILITY', message: `No available slots found for "${specialtyName}" within ${searchDays} days` };
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  const best = candidates[0];
  
  return {
    doctor: best.doctor,
    specialty_id: specialtyId,
    slots: best.slots,
    selectionReason: best.selectionReason,
    alternates: candidates.slice(1, 3).map(c => ({
      doctor_id: c.doctor.id,
      doctor_name: `Dr. ${c.doctor.first_name} ${c.doctor.last_name}`,
      score: c.score,
      slots_available: c.slots.length,
    })),
  };
}

module.exports = { findBestDoctor };
