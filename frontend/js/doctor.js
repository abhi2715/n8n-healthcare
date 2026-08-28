/**
 * Doctor Dashboard — Client-side logic
 */
document.addEventListener('DOMContentLoaded', () => {
  loadDoctors();
});

async function loadDoctors() {
  try {
    const data = await api('/doctors');
    const select = document.getElementById('doctor-select');
    data.doctors.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `Dr. ${d.first_name} ${d.last_name} — ${d.specialty_name} (${d.upcoming_appointments} upcoming)`;
      select.appendChild(opt);
    });
  } catch (err) {
    showToast('Failed to load doctors', 'error');
  }
}

async function loadDoctorView() {
  const doctorId = document.getElementById('doctor-select').value;
  const infoDiv = document.getElementById('doctor-info');
  
  if (!doctorId) {
    infoDiv.style.display = 'none';
    return;
  }
  
  try {
    const data = await api(`/doctors/${doctorId}`);
    infoDiv.style.display = 'block';
    
    const d = data.doctor;
    document.getElementById('doctor-details').innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="margin-bottom: 4px;">Dr. ${escapeHtml(d.first_name)} ${escapeHtml(d.last_name)}</h2>
          <p style="color: var(--text-secondary);">${escapeHtml(d.specialty_name)} • ${escapeHtml(d.location || 'No location')}</p>
          <p style="color: var(--text-muted); font-size: var(--font-size-sm);">${escapeHtml(d.bio || '')}</p>
        </div>
        <div style="text-align: right;">
          <div class="stat-value" style="font-size: var(--font-size-2xl);">${data.upcoming_appointments.length}</div>
          <div class="stat-label">Upcoming</div>
        </div>
      </div>
    `;
    
    renderAppointments(data.upcoming_appointments);
  } catch (err) {
    showToast('Failed to load doctor data', 'error');
  }
}

function renderAppointments(appointments) {
  const container = document.getElementById('appointments-list');
  
  if (!appointments || appointments.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📅</div><p>No upcoming appointments</p></div>';
    return;
  }
  
  container.innerHTML = appointments.map(a => {
    const redFlags = a.red_flags ? (typeof a.red_flags === 'string' ? JSON.parse(a.red_flags) : a.red_flags) : [];
    const reviewPoints = a.clinician_review_points ? (typeof a.clinician_review_points === 'string' ? JSON.parse(a.clinician_review_points) : a.clinician_review_points) : [];
    
    return `
    <div class="card" style="margin-bottom: var(--space-md);">
      <div class="card-header">
        <div>
          <h3 style="margin-bottom: 2px;">${escapeHtml(a.patient_first_name || '')} ${escapeHtml(a.patient_last_name || '')}</h3>
          <span style="color: var(--text-muted); font-size: var(--font-size-sm);">${formatDate(a.appointment_date)} at ${a.start_time} • ${a.duration_minutes || 30} min</span>
        </div>
        <div style="display: flex; gap: var(--space-sm); align-items: center;">
          ${a.urgency ? urgencyBadge(a.urgency) : ''}
          ${statusBadge(a.status)}
        </div>
      </div>
      
      ${a.triage_summary ? `
        <div class="ai-disclaimer" style="margin-bottom: var(--space-sm);">
          ⚠️ AI-Generated Triage Summary — Requires clinician review
        </div>
        <p style="font-size: var(--font-size-sm); margin-bottom: var(--space-sm);">${escapeHtml(a.triage_summary)}</p>
      ` : ''}
      
      ${redFlags.length > 0 ? `
        <div style="margin-bottom: var(--space-sm);">
          <strong style="color: var(--accent-danger); font-size: var(--font-size-sm);">🚩 Red Flags:</strong>
          ${redFlags.map(f => `<span class="tag" style="border-color: rgba(239, 68, 68, 0.3);">${escapeHtml(f)}</span>`).join(' ')}
        </div>
      ` : ''}
      
      ${reviewPoints.length > 0 ? `
        <div style="margin-bottom: var(--space-sm);">
          <strong style="font-size: var(--font-size-sm); color: var(--text-secondary);">📋 Review Points:</strong>
          <ul style="font-size: var(--font-size-sm); color: var(--text-secondary); padding-left: var(--space-lg);">
            ${reviewPoints.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-sm);">
        <button class="btn btn-sm btn-primary" onclick="generateBrief('${a.id}')">📄 Generate Brief</button>
        ${a.status === 'SCHEDULED' ? `<button class="btn btn-sm btn-secondary" onclick="updateStatus('${a.id}', 'COMPLETED')">✅ Complete</button>` : ''}
        ${a.status === 'SCHEDULED' ? `<button class="btn btn-sm btn-danger" onclick="updateStatus('${a.id}', 'NO_SHOW')">❌ No-Show</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function generateBrief(appointmentId) {
  try {
    showToast('Generating preparation brief...', 'info');
    const data = await api(`/appointments/${appointmentId}/brief`, { method: 'POST' });
    
    const brief = data.brief;
    document.getElementById('brief-content').innerHTML = `
      <div style="display: grid; gap: var(--space-md);">
        <div><strong>Patient Overview</strong><p style="color: var(--text-secondary);">${escapeHtml(brief.patient_overview)}</p></div>
        <div><strong>Reason for Visit</strong><p style="color: var(--text-secondary);">${escapeHtml(brief.reason_for_visit)}</p></div>
        <div><strong>Symptom Timeline</strong><p style="color: var(--text-secondary);">${escapeHtml(brief.symptom_timeline)}</p></div>
        <div class="grid-2">
          <div><strong>Relevant History</strong><p style="color: var(--text-secondary);">${escapeHtml(brief.relevant_history)}</p></div>
          <div><strong>Current Medications</strong><p style="color: var(--text-secondary);">${escapeHtml(brief.current_medications)}</p></div>
        </div>
        <div><strong>Known Allergies</strong><p style="color: var(--text-secondary);">${escapeHtml(brief.known_allergies)}</p></div>
        <div style="background: var(--accent-warning-bg); padding: var(--space-md); border-radius: var(--radius-md);">
          <strong style="color: var(--accent-warning);">AI Triage Summary</strong>
          <p style="color: var(--text-secondary); margin-top: 4px;">${escapeHtml(brief.ai_triage_summary)}</p>
        </div>
        ${(brief.potential_red_flags || []).length > 0 ? `
          <div style="background: var(--accent-danger-bg); padding: var(--space-md); border-radius: var(--radius-md);">
            <strong style="color: var(--accent-danger);">Potential Red Flags</strong>
            <ul style="color: var(--text-secondary); padding-left: var(--space-lg);">
              ${brief.potential_red_flags.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
            </ul>
          </div>` : ''}
        <div><strong>Appointment</strong><p style="color: var(--text-secondary);">${escapeHtml(brief.appointment_details)}</p></div>
      </div>
    `;
    document.getElementById('brief-modal').classList.add('active');
  } catch (err) {
    showToast('Failed to generate brief: ' + err.message, 'error');
  }
}

function closeBriefModal() {
  document.getElementById('brief-modal').classList.remove('active');
}

async function updateStatus(appointmentId, status) {
  try {
    await api(`/appointments/${appointmentId}`, { method: 'PATCH', body: { status } });
    showToast(`Appointment marked as ${status}`, 'success');
    loadDoctorView();
  } catch (err) {
    showToast('Failed to update: ' + err.message, 'error');
  }
}
