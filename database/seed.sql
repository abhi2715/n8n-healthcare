-- ============================================================
-- Healthcare AI Platform — Seed Data
-- ============================================================
-- ALL DATA IS SYNTHETIC / FICTIONAL
-- Do NOT use real patient information
-- ============================================================

-- ============================================================
-- SPECIALTIES (10)
-- ============================================================

INSERT INTO specialties (id, name, description) VALUES
('a1000000-0000-0000-0000-000000000001', 'General Medicine', 'Primary care and general health concerns'),
('a1000000-0000-0000-0000-000000000002', 'Cardiology', 'Heart and cardiovascular system'),
('a1000000-0000-0000-0000-000000000003', 'Neurology', 'Brain, spinal cord, and nervous system'),
('a1000000-0000-0000-0000-000000000004', 'Dermatology', 'Skin, hair, and nails'),
('a1000000-0000-0000-0000-000000000005', 'Orthopedics', 'Bones, joints, and muscles'),
('a1000000-0000-0000-0000-000000000006', 'Pediatrics', 'Medical care for infants, children, and adolescents'),
('a1000000-0000-0000-0000-000000000007', 'ENT', 'Ear, nose, and throat'),
('a1000000-0000-0000-0000-000000000008', 'Gastroenterology', 'Digestive system and gastrointestinal tract'),
('a1000000-0000-0000-0000-000000000009', 'Psychiatry', 'Mental health and behavioral disorders'),
('a1000000-0000-0000-0000-000000000010', 'Pulmonology', 'Respiratory system and lungs');

-- ============================================================
-- DOCTORS (10)
-- ============================================================

INSERT INTO doctors (id, first_name, last_name, email, phone, specialty_id, license_number, max_daily_appointments, appointment_duration_minutes, location, bio) VALUES
('d1000000-0000-0000-0000-000000000001', 'Sarah', 'Chen', 'dr.chen@healthcaredemo.local', '+1-555-0101', 'a1000000-0000-0000-0000-000000000001', 'MD-2024-001', 10, 30, 'Building A, Room 101', 'Board-certified internist with 15 years of experience in primary care.'),
('d1000000-0000-0000-0000-000000000002', 'James', 'Rodriguez', 'dr.rodriguez@healthcaredemo.local', '+1-555-0102', 'a1000000-0000-0000-0000-000000000002', 'MD-2024-002', 8, 45, 'Building B, Room 201', 'Fellowship-trained cardiologist specializing in preventive cardiology.'),
('d1000000-0000-0000-0000-000000000003', 'Priya', 'Sharma', 'dr.sharma@healthcaredemo.local', '+1-555-0103', 'a1000000-0000-0000-0000-000000000003', 'MD-2024-003', 8, 45, 'Building B, Room 205', 'Neurologist with expertise in headache and movement disorders.'),
('d1000000-0000-0000-0000-000000000004', 'Michael', 'Kim', 'dr.kim@healthcaredemo.local', '+1-555-0104', 'a1000000-0000-0000-0000-000000000004', 'MD-2024-004', 12, 20, 'Building A, Room 110', 'Dermatologist specializing in medical and cosmetic dermatology.'),
('d1000000-0000-0000-0000-000000000005', 'Elena', 'Volkov', 'dr.volkov@healthcaredemo.local', '+1-555-0105', 'a1000000-0000-0000-0000-000000000005', 'MD-2024-005', 8, 30, 'Building C, Room 301', 'Orthopedic surgeon with focus on sports medicine and joint repair.'),
('d1000000-0000-0000-0000-000000000006', 'David', 'Okafor', 'dr.okafor@healthcaredemo.local', '+1-555-0106', 'a1000000-0000-0000-0000-000000000006', 'MD-2024-006', 12, 25, 'Building A, Room 115', 'Pediatrician with special interest in developmental pediatrics.'),
('d1000000-0000-0000-0000-000000000007', 'Lisa', 'Nakamura', 'dr.nakamura@healthcaredemo.local', '+1-555-0107', 'a1000000-0000-0000-0000-000000000007', 'MD-2024-007', 10, 30, 'Building B, Room 210', 'ENT specialist with expertise in sinus and allergy management.'),
('d1000000-0000-0000-0000-000000000008', 'Robert', 'Patel', 'dr.patel@healthcaredemo.local', '+1-555-0108', 'a1000000-0000-0000-0000-000000000008', 'MD-2024-008', 8, 40, 'Building C, Room 305', 'Gastroenterologist with focus on inflammatory bowel disease.'),
('d1000000-0000-0000-0000-000000000009', 'Amanda', 'Fischer', 'dr.fischer@healthcaredemo.local', '+1-555-0109', 'a1000000-0000-0000-0000-000000000009', 'MD-2024-009', 8, 50, 'Building D, Room 401', 'Psychiatrist specializing in anxiety, depression, and cognitive behavioral therapy.'),
('d1000000-0000-0000-0000-000000000010', 'Thomas', 'Adeyemi', 'dr.adeyemi@healthcaredemo.local', '+1-555-0110', 'a1000000-0000-0000-0000-000000000010', 'MD-2024-010', 8, 30, 'Building B, Room 215', 'Pulmonologist with expertise in asthma, COPD, and sleep disorders.');

-- ============================================================
-- DOCTOR AVAILABILITY (weekly schedules)
-- ============================================================

-- Dr. Chen (General Medicine) — Mon-Fri 09:00-17:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000001', 'MONDAY', '09:00', '17:00'),
('d1000000-0000-0000-0000-000000000001', 'TUESDAY', '09:00', '17:00'),
('d1000000-0000-0000-0000-000000000001', 'WEDNESDAY', '09:00', '17:00'),
('d1000000-0000-0000-0000-000000000001', 'THURSDAY', '09:00', '17:00'),
('d1000000-0000-0000-0000-000000000001', 'FRIDAY', '09:00', '15:00');

-- Dr. Rodriguez (Cardiology) — Mon,Wed,Fri 08:00-16:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000002', 'MONDAY', '08:00', '16:00'),
('d1000000-0000-0000-0000-000000000002', 'WEDNESDAY', '08:00', '16:00'),
('d1000000-0000-0000-0000-000000000002', 'FRIDAY', '08:00', '16:00');

-- Dr. Sharma (Neurology) — Tue,Thu 09:00-17:00, Sat 09:00-13:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000003', 'TUESDAY', '09:00', '17:00'),
('d1000000-0000-0000-0000-000000000003', 'THURSDAY', '09:00', '17:00'),
('d1000000-0000-0000-0000-000000000003', 'SATURDAY', '09:00', '13:00');

-- Dr. Kim (Dermatology) — Mon-Thu 10:00-18:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000004', 'MONDAY', '10:00', '18:00'),
('d1000000-0000-0000-0000-000000000004', 'TUESDAY', '10:00', '18:00'),
('d1000000-0000-0000-0000-000000000004', 'WEDNESDAY', '10:00', '18:00'),
('d1000000-0000-0000-0000-000000000004', 'THURSDAY', '10:00', '18:00');

-- Dr. Volkov (Orthopedics) — Mon,Tue,Wed,Fri 08:00-15:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000005', 'MONDAY', '08:00', '15:00'),
('d1000000-0000-0000-0000-000000000005', 'TUESDAY', '08:00', '15:00'),
('d1000000-0000-0000-0000-000000000005', 'WEDNESDAY', '08:00', '15:00'),
('d1000000-0000-0000-0000-000000000005', 'FRIDAY', '08:00', '15:00');

-- Dr. Okafor (Pediatrics) — Mon-Fri 08:30-16:30
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000006', 'MONDAY', '08:30', '16:30'),
('d1000000-0000-0000-0000-000000000006', 'TUESDAY', '08:30', '16:30'),
('d1000000-0000-0000-0000-000000000006', 'WEDNESDAY', '08:30', '16:30'),
('d1000000-0000-0000-0000-000000000006', 'THURSDAY', '08:30', '16:30'),
('d1000000-0000-0000-0000-000000000006', 'FRIDAY', '08:30', '16:30');

-- Dr. Nakamura (ENT) — Mon,Wed,Thu,Fri 09:00-16:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000007', 'MONDAY', '09:00', '16:00'),
('d1000000-0000-0000-0000-000000000007', 'WEDNESDAY', '09:00', '16:00'),
('d1000000-0000-0000-0000-000000000007', 'THURSDAY', '09:00', '16:00'),
('d1000000-0000-0000-0000-000000000007', 'FRIDAY', '09:00', '16:00');

-- Dr. Patel (Gastroenterology) — Tue,Wed,Thu 08:00-16:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000008', 'TUESDAY', '08:00', '16:00'),
('d1000000-0000-0000-0000-000000000008', 'WEDNESDAY', '08:00', '16:00'),
('d1000000-0000-0000-0000-000000000008', 'THURSDAY', '08:00', '16:00');

-- Dr. Fischer (Psychiatry) — Mon,Tue,Thu 10:00-18:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000009', 'MONDAY', '10:00', '18:00'),
('d1000000-0000-0000-0000-000000000009', 'TUESDAY', '10:00', '18:00'),
('d1000000-0000-0000-0000-000000000009', 'THURSDAY', '10:00', '18:00');

-- Dr. Adeyemi (Pulmonology) — Mon,Wed,Fri 09:00-17:00
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
('d1000000-0000-0000-0000-000000000010', 'MONDAY', '09:00', '17:00'),
('d1000000-0000-0000-0000-000000000010', 'WEDNESDAY', '09:00', '17:00'),
('d1000000-0000-0000-0000-000000000010', 'FRIDAY', '09:00', '17:00');

-- ============================================================
-- PATIENTS (20 synthetic)
-- ============================================================

INSERT INTO patients (id, first_name, last_name, date_of_birth, age, email, phone, gender) VALUES
('p1000000-0000-0000-0000-000000000001', 'Alice', 'Johnson', '1985-03-15', 41, 'alice.johnson@demo.local', '+1-555-1001', 'Female'),
('p1000000-0000-0000-0000-000000000002', 'Bob', 'Williams', '1972-07-22', 54, 'bob.williams@demo.local', '+1-555-1002', 'Male'),
('p1000000-0000-0000-0000-000000000003', 'Carmen', 'Diaz', '1990-11-08', 35, 'carmen.diaz@demo.local', '+1-555-1003', 'Female'),
('p1000000-0000-0000-0000-000000000004', 'Daniel', 'Lee', '1968-01-30', 58, 'daniel.lee@demo.local', '+1-555-1004', 'Male'),
('p1000000-0000-0000-0000-000000000005', 'Emma', 'Taylor', '1995-06-14', 31, 'emma.taylor@demo.local', '+1-555-1005', 'Female'),
('p1000000-0000-0000-0000-000000000006', 'Frank', 'Nguyen', '1980-09-03', 45, 'frank.nguyen@demo.local', '+1-555-1006', 'Male'),
('p1000000-0000-0000-0000-000000000007', 'Grace', 'Okonkwo', '2000-12-20', 25, 'grace.okonkwo@demo.local', '+1-555-1007', 'Female'),
('p1000000-0000-0000-0000-000000000008', 'Henry', 'Mueller', '1955-04-11', 71, 'henry.mueller@demo.local', '+1-555-1008', 'Male'),
('p1000000-0000-0000-0000-000000000009', 'Isabel', 'Santos', '1988-08-25', 37, 'isabel.santos@demo.local', '+1-555-1009', 'Female'),
('p1000000-0000-0000-0000-000000000010', 'Jack', 'Brown', '1978-02-17', 48, 'jack.brown@demo.local', '+1-555-1010', 'Male'),
('p1000000-0000-0000-0000-000000000011', 'Keiko', 'Tanaka', '1992-05-09', 34, 'keiko.tanaka@demo.local', '+1-555-1011', 'Female'),
('p1000000-0000-0000-0000-000000000012', 'Liam', 'OBrien', '1983-10-28', 42, 'liam.obrien@demo.local', '+1-555-1012', 'Male'),
('p1000000-0000-0000-0000-000000000013', 'Maya', 'Petrov', '1997-01-04', 29, 'maya.petrov@demo.local', '+1-555-1013', 'Female'),
('p1000000-0000-0000-0000-000000000014', 'Nathan', 'Ali', '1975-06-19', 51, 'nathan.ali@demo.local', '+1-555-1014', 'Male'),
('p1000000-0000-0000-0000-000000000015', 'Olivia', 'Garcia', '2005-03-30', 21, 'olivia.garcia@demo.local', '+1-555-1015', 'Female'),
('p1000000-0000-0000-0000-000000000016', 'Paul', 'Svensson', '1960-11-12', 65, 'paul.svensson@demo.local', '+1-555-1016', 'Male'),
('p1000000-0000-0000-0000-000000000017', 'Quinn', 'Foster', '1993-07-07', 33, 'quinn.foster@demo.local', '+1-555-1017', 'Non-binary'),
('p1000000-0000-0000-0000-000000000018', 'Rita', 'Kapoor', '1987-09-15', 38, 'rita.kapoor@demo.local', '+1-555-1018', 'Female'),
('p1000000-0000-0000-0000-000000000019', 'Samuel', 'Cohen', '1970-04-22', 56, 'samuel.cohen@demo.local', '+1-555-1019', 'Male'),
('p1000000-0000-0000-0000-000000000020', 'Tara', 'Wilson', '1999-12-01', 26, 'tara.wilson@demo.local', '+1-555-1020', 'Female');

-- ============================================================
-- MEDICAL HISTORY (for select patients)
-- ============================================================

INSERT INTO medical_history (patient_id, condition_name, diagnosed_date, status) VALUES
('p1000000-0000-0000-0000-000000000002', 'Hypertension', '2015-03-10', 'active'),
('p1000000-0000-0000-0000-000000000002', 'Type 2 Diabetes', '2018-07-15', 'active'),
('p1000000-0000-0000-0000-000000000004', 'Atrial Fibrillation', '2020-01-22', 'active'),
('p1000000-0000-0000-0000-000000000004', 'Hyperlipidemia', '2016-05-10', 'active'),
('p1000000-0000-0000-0000-000000000008', 'COPD', '2012-09-05', 'active'),
('p1000000-0000-0000-0000-000000000008', 'Osteoarthritis', '2019-03-18', 'active'),
('p1000000-0000-0000-0000-000000000010', 'Asthma', '1990-06-20', 'active'),
('p1000000-0000-0000-0000-000000000016', 'Coronary Artery Disease', '2017-11-30', 'active'),
('p1000000-0000-0000-0000-000000000019', 'Gastroesophageal Reflux', '2019-08-12', 'active');

-- ============================================================
-- MEDICATIONS (for select patients)
-- ============================================================

INSERT INTO medications (patient_id, medication_name, dosage, frequency) VALUES
('p1000000-0000-0000-0000-000000000002', 'Lisinopril', '10mg', 'Once daily'),
('p1000000-0000-0000-0000-000000000002', 'Metformin', '500mg', 'Twice daily'),
('p1000000-0000-0000-0000-000000000004', 'Warfarin', '5mg', 'Once daily'),
('p1000000-0000-0000-0000-000000000004', 'Atorvastatin', '20mg', 'Once daily at bedtime'),
('p1000000-0000-0000-0000-000000000008', 'Tiotropium Inhaler', '18mcg', 'Once daily'),
('p1000000-0000-0000-0000-000000000008', 'Acetaminophen', '500mg', 'As needed'),
('p1000000-0000-0000-0000-000000000010', 'Albuterol Inhaler', '90mcg', 'As needed'),
('p1000000-0000-0000-0000-000000000016', 'Aspirin', '81mg', 'Once daily'),
('p1000000-0000-0000-0000-000000000016', 'Metoprolol', '50mg', 'Twice daily'),
('p1000000-0000-0000-0000-000000000019', 'Omeprazole', '20mg', 'Once daily before breakfast');

-- ============================================================
-- ALLERGIES (for select patients)
-- ============================================================

INSERT INTO allergies (patient_id, allergen, reaction, severity) VALUES
('p1000000-0000-0000-0000-000000000001', 'Penicillin', 'Rash and hives', 'MODERATE'),
('p1000000-0000-0000-0000-000000000005', 'Sulfa drugs', 'Difficulty breathing', 'SEVERE'),
('p1000000-0000-0000-0000-000000000007', 'Latex', 'Skin irritation', 'MILD'),
('p1000000-0000-0000-0000-000000000010', 'Peanuts', 'Anaphylaxis', 'CRITICAL'),
('p1000000-0000-0000-0000-000000000013', 'Ibuprofen', 'Stomach upset', 'MILD'),
('p1000000-0000-0000-0000-000000000018', 'Shellfish', 'Hives and swelling', 'MODERATE');

-- ============================================================
-- SAMPLE AUDIT LOGS
-- ============================================================

INSERT INTO audit_logs (event_type, patient_id, actor, ai_involved, action, result, details) VALUES
('SYSTEM_STARTED', NULL, 'system', false, 'Healthcare AI Platform initialized', 'success', '{"version": "1.0.0", "environment": "development"}'::jsonb),
('SEED_DATA_LOADED', NULL, 'system', false, 'Synthetic seed data loaded successfully', 'success', '{"patients": 20, "doctors": 10, "specialties": 10}'::jsonb);
