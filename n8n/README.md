# n8n Workflow Import Guide

## Overview

This directory contains n8n workflow JSON files for the Healthcare AI Platform.

The workflows integrate with the backend API and PostgreSQL database.

## Workflows

| # | Workflow | Description |
|---|---|---|
| 01 | Healthcare Orchestrator | Main intake pipeline — webhook → validate → patient record → safety pre-scan |
| 04 | AI Triage Agent | Groq-powered triage with structured output validation |
| 05 | Safety Evaluation | Deterministic emergency detection rules |

## How to Import

1. Open n8n at http://localhost:5678
2. Login with `admin` / `admin`
3. Click **Settings** (gear icon) → **Community Nodes** → ensure Groq is available
4. Go to **Workflows** → **Import from File**
5. Select `healthcare_workflows.json`
6. All 3 workflows will be imported

## Credential Setup

After importing, configure credentials:

### 1. PostgreSQL Credential
- **Name:** Healthcare PostgreSQL
- **Host:** postgres (if inside Docker) or localhost (if external)
- **Port:** 5432
- **Database:** healthcare_platform
- **User:** healthcare
- **Password:** healthcare_dev_2024

### 2. Groq API Credential
- **Name:** Groq API
- **API Key:** Your Groq API key from console.groq.com

## Architecture Notes

The **main orchestrator** (Workflow 01) serves as the central intake pipeline. For the full end-to-end workflow including AI triage, specialty routing, doctor matching, and appointment scheduling, the **backend API** (`POST /api/intake`) handles the complete pipeline including:

1. Input validation
2. Patient record creation/deduplication
3. AI triage via Groq
4. Deterministic safety evaluation
5. Specialty routing
6. Doctor matching (weighted scoring)
7. Appointment scheduling (double-booking prevention)
8. Patient & doctor notifications
9. Follow-up scheduling
10. Audit trail

The n8n workflows demonstrate the same capabilities in visual workflow form and can be extended to handle additional orchestration patterns.
