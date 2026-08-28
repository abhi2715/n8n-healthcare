-- ============================================================
-- Healthcare AI Platform — Database Schema
-- ============================================================
-- DISCLAIMER: This is a PORTFOLIO/EDUCATIONAL project.
-- Uses synthetic data only. NOT HIPAA compliant.
-- Must NOT be connected to real patient information.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE urgency_level AS ENUM ('EMERGENCY', 'URGENT', 'ROUTINE', 'NON_URGENT');
CREATE TYPE appointment_status AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE intake_status AS ENUM ('RECEIVED', 'VALIDATING', 'VALIDATED', 'PROCESSING', 'TRIAGED', 'SCHEDULED', 'COMPLETED', 'FAILED', 'ESCALATED');
CREATE TYPE notification_type AS ENUM ('EMAIL', 'SMS', 'IN_APP', 'SLACK');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRY');
CREATE TYPE followup_status AS ENUM ('PENDING', 'SENT', 'RESPONDED', 'ESCALATED', 'CLOSED', 'NO_RESPONSE');
CREATE TYPE response_classification AS ENUM ('IMPROVING', 'UNCHANGED', 'WORSENING', 'URGENT_CONCERN', 'NO_RESPONSE');
CREATE TYPE review_status AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED');
CREATE TYPE severity_level AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'CRITICAL');
CREATE TYPE day_of_week AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- ============================================================
-- SPECIALTIES
-- ============================================================

CREATE TABLE specialties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_specialties_name ON specialties(name);

-- ============================================================
-- PATIENTS
-- ============================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    age INTEGER CHECK (age >= 0 AND age <= 150),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    gender VARCHAR(20),
    address TEXT,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(30),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_dob ON patients(date_of_birth);

-- ============================================================
-- PATIENT INTAKE
-- ============================================================

CREATE TABLE patient_intake (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    status intake_status DEFAULT 'RECEIVED',
    
    -- Raw intake data
    full_name VARCHAR(200) NOT NULL,
    date_of_birth VARCHAR(20),
    age INTEGER,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    
    -- Symptoms
    symptoms TEXT NOT NULL,
    symptom_duration VARCHAR(100),
    severity severity_level DEFAULT 'MILD',
    
    -- Medical background
    existing_conditions TEXT,
    current_medications TEXT,
    allergies TEXT,
    
    -- Preferences
    preferred_appointment_time VARCHAR(100),
    preferred_communication VARCHAR(50) DEFAULT 'email',
    
    -- Processing metadata
    correlation_id UUID DEFAULT uuid_generate_v4(),
    workflow_execution_id VARCHAR(255),
    raw_payload JSONB,
    validation_errors JSONB,
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intake_patient ON patient_intake(patient_id);
CREATE INDEX idx_intake_status ON patient_intake(status);
CREATE INDEX idx_intake_correlation ON patient_intake(correlation_id);
CREATE INDEX idx_intake_idempotency ON patient_intake(idempotency_key);
CREATE INDEX idx_intake_created ON patient_intake(created_at DESC);

-- ============================================================
-- MEDICAL HISTORY
-- ============================================================

CREATE TABLE medical_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    condition_name VARCHAR(200) NOT NULL,
    diagnosed_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_history_patient ON medical_history(patient_id);

-- ============================================================
-- MEDICATIONS
-- ============================================================

CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    start_date DATE,
    is_current BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medications_patient ON medications(patient_id);

-- ============================================================
-- ALLERGIES
-- ============================================================

CREATE TABLE allergies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    allergen VARCHAR(200) NOT NULL,
    reaction VARCHAR(200),
    severity severity_level DEFAULT 'MILD',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_allergies_patient ON allergies(patient_id);

-- ============================================================
-- DOCTORS
-- ============================================================

CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30),
    specialty_id UUID NOT NULL REFERENCES specialties(id),
    license_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    max_daily_appointments INTEGER DEFAULT 8,
    appointment_duration_minutes INTEGER DEFAULT 30,
    location VARCHAR(200),
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doctors_specialty ON doctors(specialty_id);
CREATE INDEX idx_doctors_active ON doctors(is_active);

-- ============================================================
-- DOCTOR AVAILABILITY
-- ============================================================

CREATE TABLE doctor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week day_of_week NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (start_time < end_time),
    UNIQUE(doctor_id, day_of_week, start_time)
);

CREATE INDEX idx_availability_doctor ON doctor_availability(doctor_id);
CREATE INDEX idx_availability_day ON doctor_availability(day_of_week);

-- ============================================================
-- TRIAGE ASSESSMENTS
-- ============================================================

CREATE TABLE triage_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intake_id UUID NOT NULL REFERENCES patient_intake(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id),
    
    -- Triage results
    urgency urgency_level NOT NULL,
    risk_score NUMERIC(3,1) CHECK (risk_score >= 0 AND risk_score <= 10),
    specialty_recommended VARCHAR(100),
    specialty_id UUID REFERENCES specialties(id),
    red_flags JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    clinician_review_points JSONB DEFAULT '[]'::jsonb,
    recommended_next_step TEXT,
    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    requires_human_review BOOLEAN DEFAULT false,
    
    -- AI metadata
    ai_model VARCHAR(100),
    ai_raw_output JSONB,
    ai_prompt_tokens INTEGER,
    ai_completion_tokens INTEGER,
    ai_latency_ms INTEGER,
    ai_retry_count INTEGER DEFAULT 0,
    
    -- Safety evaluation
    safety_evaluation_passed BOOLEAN,
    safety_rules_triggered JSONB DEFAULT '[]'::jsonb,
    deterministic_override BOOLEAN DEFAULT false,
    
    -- Validation
    output_validation_passed BOOLEAN,
    validation_errors JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_triage_intake ON triage_assessments(intake_id);
CREATE INDEX idx_triage_patient ON triage_assessments(patient_id);
CREATE INDEX idx_triage_urgency ON triage_assessments(urgency);
CREATE INDEX idx_triage_created ON triage_assessments(created_at DESC);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    intake_id UUID REFERENCES patient_intake(id),
    triage_id UUID REFERENCES triage_assessments(id),
    
    -- Scheduling
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    
    -- Details
    status appointment_status DEFAULT 'SCHEDULED',
    urgency urgency_level DEFAULT 'ROUTINE',
    reason TEXT,
    specialty_id UUID REFERENCES specialties(id),
    
    -- Metadata
    selection_reason TEXT,
    booking_source VARCHAR(50) DEFAULT 'system',
    notes TEXT,
    cancellation_reason TEXT,
    
    -- Doctor brief
    doctor_brief_generated BOOLEAN DEFAULT false,
    doctor_brief JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent double booking
    CONSTRAINT unique_doctor_slot UNIQUE(doctor_id, appointment_date, start_time),
    CONSTRAINT valid_appointment_time CHECK (start_time < end_time)
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('patient', 'doctor', 'admin')),
    recipient_id UUID,
    recipient_email VARCHAR(255),
    
    notification_type notification_type DEFAULT 'EMAIL',
    status notification_status DEFAULT 'PENDING',
    
    subject VARCHAR(500),
    body TEXT,
    template VARCHAR(100),
    
    -- Context
    patient_id UUID REFERENCES patients(id),
    appointment_id UUID REFERENCES appointments(id),
    intake_id UUID REFERENCES patient_intake(id),
    
    -- Delivery
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_patient ON notifications(patient_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- FOLLOW-UPS
-- ============================================================

CREATE TABLE followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    appointment_id UUID REFERENCES appointments(id),
    intake_id UUID REFERENCES patient_intake(id),
    
    status followup_status DEFAULT 'PENDING',
    
    -- Scheduling
    scheduled_date TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    
    -- Follow-up content
    followup_message TEXT,
    patient_response TEXT,
    response_classification response_classification,
    
    -- AI analysis
    ai_classification JSONB,
    requires_escalation BOOLEAN DEFAULT false,
    escalation_reason TEXT,
    
    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(100),
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_followups_patient ON followups(patient_id);
CREATE INDEX idx_followups_status ON followups(status);
CREATE INDEX idx_followups_scheduled ON followups(scheduled_date);
CREATE INDEX idx_followups_appointment ON followups(appointment_id);

-- ============================================================
-- FEEDBACK
-- ============================================================

CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    appointment_id UUID REFERENCES appointments(id),
    doctor_id UUID REFERENCES doctors(id),
    
    -- Ratings (1-5)
    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    waiting_experience INTEGER CHECK (waiting_experience >= 1 AND waiting_experience <= 5),
    overall_experience INTEGER CHECK (overall_experience >= 1 AND overall_experience <= 5),
    
    -- Free text
    comments TEXT,
    
    -- AI analysis
    sentiment VARCHAR(20),
    topics JSONB DEFAULT '[]'::jsonb,
    ai_analysis JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_patient ON feedback(patient_id);
CREATE INDEX idx_feedback_doctor ON feedback(doctor_id);
CREATE INDEX idx_feedback_appointment ON feedback(appointment_id);

-- ============================================================
-- HUMAN REVIEW TASKS
-- ============================================================

CREATE TABLE human_review_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Context
    patient_id UUID REFERENCES patients(id),
    intake_id UUID REFERENCES patient_intake(id),
    triage_id UUID REFERENCES triage_assessments(id),
    appointment_id UUID REFERENCES appointments(id),
    followup_id UUID REFERENCES followups(id),
    
    -- Task
    review_type VARCHAR(50) NOT NULL,
    priority urgency_level DEFAULT 'ROUTINE',
    status review_status DEFAULT 'PENDING',
    
    title VARCHAR(500) NOT NULL,
    description TEXT,
    reason TEXT NOT NULL,
    
    -- AI context
    ai_output JSONB,
    safety_flags JSONB DEFAULT '[]'::jsonb,
    
    -- Resolution
    assigned_to VARCHAR(100),
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMPTZ,
    resolution TEXT,
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_status ON human_review_tasks(status);
CREATE INDEX idx_review_priority ON human_review_tasks(priority);
CREATE INDEX idx_review_patient ON human_review_tasks(patient_id);
CREATE INDEX idx_review_created ON human_review_tasks(created_at DESC);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identifiers
    event_type VARCHAR(100) NOT NULL,
    correlation_id UUID,
    workflow_execution_id VARCHAR(255),
    
    -- Context
    patient_id UUID,
    intake_id UUID,
    appointment_id UUID,
    doctor_id UUID,
    
    -- Event details
    actor VARCHAR(100) DEFAULT 'system',
    ai_involved BOOLEAN DEFAULT false,
    action VARCHAR(200) NOT NULL,
    result VARCHAR(50),
    
    -- Data
    details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    
    -- Metadata
    duration_ms INTEGER,
    ip_address VARCHAR(45),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_patient ON audit_logs(patient_id);
CREATE INDEX idx_audit_correlation ON audit_logs(correlation_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_intake ON audit_logs(intake_id);

-- ============================================================
-- WORKFLOW EXECUTIONS
-- ============================================================

CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    workflow_name VARCHAR(200) NOT NULL,
    n8n_execution_id VARCHAR(255),
    correlation_id UUID,
    
    -- Context
    patient_id UUID,
    intake_id UUID,
    
    -- Execution
    status VARCHAR(50) DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Results
    result JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_name ON workflow_executions(workflow_name);
CREATE INDEX idx_workflow_status ON workflow_executions(status);
CREATE INDEX idx_workflow_correlation ON workflow_executions(correlation_id);
CREATE INDEX idx_workflow_created ON workflow_executions(created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_intake_updated_at BEFORE UPDATE ON patient_intake FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_triage_updated_at BEFORE UPDATE ON triage_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_followups_updated_at BEFORE UPDATE ON followups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_review_updated_at BEFORE UPDATE ON human_review_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_specialties_updated_at BEFORE UPDATE ON specialties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
