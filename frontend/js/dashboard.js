/**
 * Admin Dashboard — Client-side logic
 */
let currentReviewId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadPatients();
  loadReviews();
  
  // Auto-refresh every 30s
  setInterval(loadDashboard, 30000);
  
  // Patient search
  const searchInput = document.getElementById('patient-search');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadPatients(e.target.value), 300);
  });
});

async function loadDashboard() {
  try {
    const data = await api('/dashboard');
    renderStats(data.stats);
    renderRecentIntakes(data.recent_intakes);
    renderDistributions(data.triage_distribution, data.specialty_distribution);
    renderAuditTrail(data.recent_audit);
  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderStats(stats) {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card info"><div class="stat-value">${stats.total_patients}</div><div class="stat-label">Total Patients</div></div>
    <div class="stat-card"><div class="stat-value">${stats.today_appointments}</div><div class="stat-label">Today's Appointments</div></div>
    <div class="stat-card emergency"><div class="stat-value">${stats.emergency_cases}</div><div class="stat-label">Emergency Cases</div></div>
    <div class="stat-card urgent"><div class="stat-value">${stats.urgent_cases}</div><div class="stat-label">Urgent Cases</div></div>
    <div class="stat-card"><div class="stat-value">${stats.routine_cases}</div><div class="stat-label">Routine Cases</div></div>
    <div class="stat-card" style="--accent: var(--accent-warning)"><div class="stat-value">${stats.pending_reviews}</div><div class="stat-label">Pending Reviews</div></div>
    <div class="stat-card"><div class="stat-value">${stats.pending_followups}</div><div class="stat-label">Pending Follow-ups</div></div>
    <div class="stat-card success"><div class="stat-value">${stats.completion_rate}%</div><div class="stat-label">Completion Rate</div></div>
  `;
}

function renderRecentIntakes(intakes) {
  const container = document.getElementById('recent-intakes');
  if (!intakes || intakes.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No recent intakes</p></div>';
    return;
  }
  
  container.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Patient</th><th>Status</th><th>Time</th></tr></thead>
    <tbody>${intakes.map(i => `
      <tr>
        <td>${escapeHtml(i.first_name || '')} ${escapeHtml(i.last_name || i.full_name || '')}</td>
        <td>${statusBadge(i.status)}</td>
        <td style="color: var(--text-muted); font-size: var(--font-size-xs);">${formatDateTime(i.created_at)}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function renderDistributions(triage, specialty) {
  const triageContainer = document.getElementById('triage-distribution');
  const specContainer = document.getElementById('specialty-distribution');
  
  const triageTotal = triage.reduce((sum, t) => sum + parseInt(t.count), 0) || 1;
  triageContainer.innerHTML = triage.map(t => {
    const pct = Math.round((parseInt(t.count) / triageTotal) * 100);
    const color = { EMERGENCY: 'var(--accent-danger)', URGENT: 'var(--accent-warning)', ROUTINE: 'var(--accent-info)', NON_URGENT: 'var(--accent-success)' }[t.urgency] || 'var(--text-muted)';
    return `<div style="margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: 4px;">
        <span>${t.urgency}</span><span>${t.count} (${pct}%)</span>
      </div>
      <div style="height: 6px; background: var(--bg-glass); border-radius: 3px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 3px; transition: width 0.5s;"></div>
      </div>
    </div>`;
  }).join('') || '<p style="color: var(--text-muted);">No triage data yet</p>';
  
  const specTotal = specialty.reduce((sum, s) => sum + parseInt(s.count), 0) || 1;
  specContainer.innerHTML = specialty.map(s => {
    const pct = Math.round((parseInt(s.count) / specTotal) * 100);
    return `<div style="margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: 4px;">
        <span>${escapeHtml(s.name)}</span><span>${s.count}</span>
      </div>
      <div style="height: 6px; background: var(--bg-glass); border-radius: 3px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: var(--accent-primary); border-radius: 3px;"></div>
      </div>
    </div>`;
  }).join('') || '<p style="color: var(--text-muted);">No specialty data yet</p>';
}

function renderAuditTrail(events) {
  const container = document.getElementById('audit-trail');
  if (!events || events.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">No audit events</p>';
    return;
  }
  
  container.innerHTML = events.slice(0, 15).map(e => `
    <div class="audit-item">
      <span class="audit-time">${formatDateTime(e.created_at)}</span>
      <span class="audit-event"><span class="tag">${escapeHtml(e.event_type)}</span></span>
      <span class="audit-detail">${escapeHtml(e.action)}</span>
    </div>
  `).join('');
}

async function loadPatients(search) {
  try {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await api(`/patients${params}`);
    renderPatients(data.patients);
  } catch (err) {
    document.getElementById('patient-list').innerHTML = `<p style="color: var(--accent-danger);">Error: ${err.message}</p>`;
  }
}

function renderPatients(patients) {
  const container = document.getElementById('patient-list');
  if (!patients || patients.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No patients found</p></div>';
    return;
  }
  
  container.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Email</th><th>Age</th><th>Appointments</th><th>Latest Urgency</th></tr></thead>
    <tbody>${patients.map(p => `
      <tr style="cursor: pointer;" onclick="window.open('/patient-detail.html?id=${p.id}', '_self')">
        <td><strong>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</strong></td>
        <td style="color: var(--text-secondary);">${escapeHtml(p.email)}</td>
        <td>${p.age || '—'}</td>
        <td>${p.appointment_count || 0}</td>
        <td>${p.latest_urgency ? urgencyBadge(p.latest_urgency) : '<span style="color: var(--text-muted);">—</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

async function loadReviews() {
  try {
    const data = await api('/human-review');
    const container = document.getElementById('review-queue');
    const countEl = document.getElementById('review-count');
    countEl.textContent = data.reviews.length;
    
    if (data.reviews.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>No pending reviews</p></div>';
      return;
    }
    
    container.innerHTML = data.reviews.map(r => `
      <div class="review-item" style="cursor: pointer;" onclick="openReview('${r.id}', '${escapeHtml(r.title)}', '${escapeHtml(r.reason || '')}', '${r.priority}')">
        <div class="priority-indicator ${(r.priority || '').toLowerCase()}"></div>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="font-size: var(--font-size-sm);">${escapeHtml(r.title)}</strong>
            ${urgencyBadge(r.priority)}
          </div>
          <p style="font-size: var(--font-size-xs); color: var(--text-muted);">${escapeHtml(r.review_type)} • ${formatDateTime(r.created_at)}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('review-queue').innerHTML = `<p style="color: var(--accent-danger);">Error loading reviews</p>`;
  }
}

function openReview(id, title, reason, priority) {
  currentReviewId = id;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <p style="color: var(--text-secondary); margin-bottom: var(--space-md);">Priority: ${urgencyBadge(priority)}</p>
    <p style="margin-bottom: var(--space-md);">${reason}</p>
    <div class="form-group">
      <label class="form-label">Resolution Notes</label>
      <textarea id="resolution-notes" class="form-textarea" placeholder="Enter your review notes..."></textarea>
    </div>`;
  document.getElementById('review-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('review-modal').classList.remove('active');
  currentReviewId = null;
}

async function resolveReview(status) {
  if (!currentReviewId) return;
  try {
    const notes = document.getElementById('resolution-notes')?.value || '';
    await api(`/human-review/${currentReviewId}`, {
      method: 'PATCH',
      body: { status, resolution: status, resolution_notes: notes, reviewed_by: 'admin' },
    });
    showToast(`Review ${status.toLowerCase()} successfully`, 'success');
    closeModal();
    loadReviews();
    loadDashboard();
  } catch (err) {
    showToast('Failed to resolve review: ' + err.message, 'error');
  }
}
