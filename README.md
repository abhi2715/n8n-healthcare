# 🏥 Healthcare AI Patient Intake, Risk Triage & Care Coordination Platform

> **⚠️ PORTFOLIO PROJECT** — This is an educational/portfolio project using synthetic data only. It is NOT a clinical diagnostic system, NOT HIPAA compliant, and must NOT be connected to real patient information.

A full-stack AI automation platform demonstrating multi-agent orchestration, deterministic safety rules, n8n workflow automation, structured LLM outputs, and healthcare care coordination.

## 🎯 Problem Statement

Healthcare clinics receive patient intake requests through multiple channels. Staff must collect information, assess urgency, route to specialties, schedule appointments, notify stakeholders, and follow up — all while maintaining safety and auditability. This platform automates the administrative coordination layer.

## 🏗️ Architecture

```
Patient Intake Form → Backend API → AI Triage (Groq LLM) → Deterministic Safety Engine
                                                                    │
                                          ┌─────────────────────────┼─────────────────────┐
                                          │                         │                     │
                                       NORMAL                   URGENT              EMERGENCY
                                          │                         │                     │
                                    Doctor Matching           Priority Sched.      Human Review
                                          │                         │              Staff Alert
                                    Apt. Scheduling                 │              Audit Log
                                          │                         │
                                    Notifications ──────────────────┘
                                          │
                                    Doctor Brief
                                          │
                                    Follow-up → Feedback → Analytics
```

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| **LLM** | Groq (llama-3.3-70b-versatile) | AI triage, doctor briefs, follow-up classification |
| **Orchestration** | n8n | Workflow automation, webhook handling |
| **Backend** | Node.js + Express | REST API, business logic, safety engine |
| **Frontend** | Vanilla HTML/CSS/JS | Patient intake, admin dashboard, doctor view |
| **Database** | PostgreSQL 16 | Relational data with 16+ tables |
| **Containerization** | Docker Compose | One-command startup |

## 🤖 AI Agents

| Agent | Model | Responsibility |
|---|---|---|
| **Triage Agent** | Groq llama-3.3-70b | Urgency classification, specialty recommendation, red flag detection |
| **Doctor Brief Agent** | Groq llama-3.3-70b | Pre-appointment preparation summaries |
| **Follow-up Agent** | Groq llama-3.3-70b | Post-visit response classification and escalation |
| **Safety Engine** | Deterministic (no AI) | Emergency keyword detection — CANNOT be overridden by AI |

## 🛡️ Safety Architecture

The deterministic safety engine runs **after** AI triage and can only **escalate** urgency (never downgrade):

- **Keyword pattern matching** against emergency indicators (chest pain, stroke, self-harm, etc.)
- **Risk score thresholds** (configurable via environment variables)
- **AI cannot override** safety rules — rules can only escalate
- Emergency cases **bypass normal scheduling** → human review + staff alert

## 📊 Database Schema

16+ tables with proper UUIDs, foreign keys, indexes, and constraints:

`patients` • `patient_intake` • `medical_history` • `medications` • `allergies` • `triage_assessments` • `specialties` • `doctors` • `doctor_availability` • `appointments` • `notifications` • `followups` • `feedback` • `human_review_tasks` • `audit_logs` • `workflow_executions`

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (with Docker Compose)
- A free Groq API key from [console.groq.com](https://console.groq.com)

### Setup

```bash
# 1. Clone/navigate to the project
cd N8N-healthcare

# 2. Create .env from template
cp .env.example .env

# 3. Edit .env and add your Groq API key
#    Replace: GROQ_API_KEY=gsk_your_groq_api_key_here
#    With:    GROQ_API_KEY=gsk_your_actual_key

# 4. Start all services
docker compose up -d --build

# 5. Wait for services to be ready (~30 seconds)
docker compose ps

# 6. Verify
curl http://localhost:3000/api/health
```

### Access Points

| Service | URL | Credentials |
|---|---|---|
| **Patient Intake** | http://localhost:3001 | — |
| **Admin Dashboard** | http://localhost:3001/dashboard.html | — |
| **Doctor Dashboard** | http://localhost:3001/doctor.html | — |
| **Backend API** | http://localhost:3000/api | — |
| **n8n Workflows** | http://localhost:5678 | admin / admin |

## 🧪 Demo Scenarios

### Scenario 1: Routine Patient
Submit via the intake form:
- **Name:** Jane Smith
- **Symptoms:** Mild headache for 2 days, no other concerns
- **Severity:** Mild

**Expected:** AI triage → ROUTINE → Doctor matched → Appointment scheduled → Confirmations sent

### Scenario 2: Emergency Case
- **Name:** John Emergency
- **Symptoms:** Severe chest pain with significant difficulty breathing
- **Severity:** Critical

**Expected:** Safety rules trigger → EMERGENCY → Human review created → Staff notification → Normal scheduling bypassed

### Scenario 3: AI Failure Handling
The system handles malformed AI output by:
1. Retrying up to 2 times
2. Validating structured JSON output
3. Falling back to severity-based triage
4. Flagging for human review
5. Creating audit trail

## 🧪 Running Tests

```bash
# Integration tests (requires running services)
bash tests/run_tests.sh
```

## 📁 Project Structure

```
N8N-healthcare/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server
│   │   ├── config/database.js    # PostgreSQL pool
│   │   ├── middleware/           # Validation, error handling
│   │   ├── routes/               # All API routes
│   │   ├── services/
│   │   │   ├── aiTriage.js       # Groq AI integration
│   │   │   ├── safetyEngine.js   # Deterministic safety rules
│   │   │   ├── scheduling.js     # Appointment slot management
│   │   │   ├── doctorMatching.js # Weighted doctor scoring
│   │   │   ├── notification.js   # Mock notification service
│   │   │   └── auditLogger.js    # Audit trail service
│   │   └── utils/
│   │       └── triageValidator.js # AI output schema validation
│   └── Dockerfile
├── frontend/
│   ├── index.html                # Patient intake form
│   ├── dashboard.html            # Admin dashboard
│   ├── doctor.html               # Doctor dashboard
│   ├── patient-detail.html       # Patient detail view
│   ├── css/styles.css            # Design system
│   ├── js/                       # Client-side logic
│   └── nginx.conf                # Reverse proxy config
├── database/
│   ├── schema.sql                # Full relational schema
│   └── seed.sql                  # 20 patients, 10 doctors
├── n8n/workflows/                # Importable workflow JSONs
├── tests/run_tests.sh            # Integration tests
├── docker-compose.yml            # All services
├── .env.example                  # Environment template
└── README.md
```

## 🔧 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/intake` | Submit patient intake (full pipeline) |
| `GET` | `/api/patients` | List patients |
| `GET` | `/api/patients/:id` | Patient detail with full history |
| `GET` | `/api/doctors` | List doctors |
| `GET` | `/api/specialties` | List specialties |
| `GET/POST/PATCH` | `/api/appointments` | Appointment CRUD |
| `POST` | `/api/appointments/:id/brief` | Generate doctor prep brief |
| `GET` | `/api/triage/:id` | Triage assessment detail |
| `GET` | `/api/dashboard` | Dashboard statistics |
| `GET` | `/api/audit/:patientId` | Patient audit trail |
| `GET/PATCH` | `/api/human-review` | Human review queue |
| `POST` | `/api/followups` | Submit follow-up response |
| `POST` | `/api/feedback` | Submit patient feedback |
| `GET` | `/api/health` | Health check |

## ⚠️ Healthcare Disclaimer

This project:
- Uses **synthetic/demo data only**
- Is **NOT** a clinically validated medical system
- Does **NOT** diagnose diseases
- Is **NOT** HIPAA compliant
- Must **NOT** be connected to real patient information
- AI assessments are **administrative aids only** — they require clinician review
- The deterministic safety engine uses **demo rules** — not a medically exhaustive rule set

## 🔒 Security

- No hardcoded credentials (all via .env)
- Input validation on both client and server
- SQL parameterized queries
- Safe logging (no sensitive data in logs)
- Database authentication
- CORS configured

## 🐛 Troubleshooting

| Issue | Fix |
|---|---|
| Docker startup fails | Run `docker compose down -v` then `docker compose up -d --build` |
| PostgreSQL connection error | Check `docker compose ps` — postgres must show "healthy" |
| AI triage returns fallback | Verify `GROQ_API_KEY` in `.env` is valid |
| Frontend can't reach API | Nginx proxies `/api/` to backend — check backend container is running |
| Port conflicts | Change ports in `docker-compose.yml` and `.env` |
| Database schema errors | Run `docker compose down -v` to reset volumes, then restart |

## 📄 License

MIT — Portfolio/educational project.
