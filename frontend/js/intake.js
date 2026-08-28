/**
 * Patient Intake Form — Client-side logic
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('intake-form');
  const submitBtn = document.getElementById('submit-btn');
  const resultPanel = document.getElementById('result-panel');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Client-side validation
    const errors = validateForm();
    if (errors.length > 0) {
      errors.forEach(err => showToast(err, 'error'));
      return;
    }
    
    // Gather form data
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
      if (value) data[key] = value;
    });
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner"></div> Processing...';
    resultPanel.style.display = 'none';
    
    try {
      const result = await api('/intake', {
        method: 'POST',
        body: data,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      });
      
      showToast(result.message || 'Intake submitted successfully!', 'success');
      renderResult(result);
      form.reset();
      
    } catch (err) {
      showToast(err.message || 'Failed to submit intake', 'error');
      renderError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit Intake Form';
    }
  });
  
  function validateForm() {
    const errors = [];
    clearErrors();
    
    const name = document.getElementById('full_name').value.trim();
    if (!name || name.length < 2) {
      setError('full_name', 'Full name is required (min 2 characters)');
      errors.push('Full name is required');
    }
    
    const email = document.getElementById('email').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('email', 'Valid email is required');
      errors.push('Valid email is required');
    }
    
    const symptoms = document.getElementById('symptoms').value.trim();
    if (!symptoms || symptoms.length < 5) {
      setError('symptoms', 'Please describe your symptoms (min 5 characters)');
      errors.push('Symptom description is required');
    }
    
    const age = document.getElementById('age').value;
    if (age && (parseInt(age) < 0 || parseInt(age) > 150)) {
      setError('age', 'Age must be between 0 and 150');
      errors.push('Invalid age');
    }
    
    return errors;
  }
  
  function setError(field, message) {
    const errorEl = document.getElementById(`error-${field}`);
    if (errorEl) errorEl.textContent = message;
    const input = document.getElementById(field);
    if (input) input.style.borderColor = 'var(--accent-danger)';
  }
  
  function clearErrors() {
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input, .form-textarea').forEach(el => el.style.borderColor = '');
  }
  
  function renderResult(result) {
    resultPanel.style.display = 'block';
    
    if (result.status === 'ESCALATED') {
      resultPanel.innerHTML = `
        <div class="card" style="border-color: rgba(239, 68, 68, 0.3);">
          <div class="card-header">
            <h3 style="color: var(--accent-danger);">🚨 Emergency Escalation</h3>
            ${urgencyBadge('EMERGENCY')}
          </div>
          <p style="margin-bottom: var(--space-md);">${escapeHtml(result.message)}</p>
          <div class="ai-disclaimer">
            ⚠️ ${escapeHtml(result.disclaimer)}
          </div>
          <div style="margin-top: var(--space-md); font-size: var(--font-size-sm); color: var(--text-muted);">
            <strong>Correlation ID:</strong> ${result.correlation_id}<br>
            <strong>Processing Time:</strong> ${result.processing_time_ms}ms
          </div>
        </div>`;
      return;
    }
    
    if (result.status === 'SCHEDULED') {
      const appt = result.appointment;
      const triage = result.triage;
      resultPanel.innerHTML = `
        <div class="card" style="border-color: rgba(16, 185, 129, 0.3);">
          <div class="card-header">
            <h3 style="color: var(--accent-success);">✅ Appointment Scheduled</h3>
            ${urgencyBadge(triage.urgency)}
          </div>
          
          <div class="grid-2" style="margin-bottom: var(--space-lg);">
            <div>
              <h4 style="margin-bottom: var(--space-sm); color: var(--text-secondary);">Appointment Details</h4>
              <p><strong>Doctor:</strong> ${escapeHtml(appt.doctor)}</p>
              <p><strong>Specialty:</strong> ${escapeHtml(appt.specialty)}</p>
              <p><strong>Date:</strong> ${formatDate(appt.date)}</p>
              <p><strong>Time:</strong> ${appt.time}</p>
              <p><strong>Location:</strong> ${escapeHtml(appt.location)}</p>
              <p><strong>Duration:</strong> ${appt.duration_minutes} minutes</p>
            </div>
            <div>
              <h4 style="margin-bottom: var(--space-sm); color: var(--text-secondary);">AI Triage Summary</h4>
              <div class="ai-disclaimer" style="margin-bottom: var(--space-sm);">
                ⚠️ AI-Generated — Requires clinician review
              </div>
              <p style="font-size: var(--font-size-sm);">${escapeHtml(triage.summary)}</p>
            </div>
          </div>
          
          <div style="font-size: var(--font-size-sm); color: var(--text-muted);">
            <strong>Correlation ID:</strong> ${result.correlation_id} •
            <strong>Processing Time:</strong> ${result.processing_time_ms}ms
          </div>
        </div>`;
    } else {
      resultPanel.innerHTML = `
        <div class="card">
          <h3>${escapeHtml(result.message || 'Intake submitted')}</h3>
          <p style="color: var(--text-secondary); margin-top: var(--space-sm);">Status: ${result.status}</p>
        </div>`;
    }
  }
  
  function renderError(message) {
    resultPanel.style.display = 'block';
    resultPanel.innerHTML = `
      <div class="card" style="border-color: rgba(239, 68, 68, 0.3);">
        <h3 style="color: var(--accent-danger);">❌ Submission Error</h3>
        <p style="color: var(--text-secondary); margin-top: var(--space-sm);">${escapeHtml(message)}</p>
      </div>`;
  }
});
