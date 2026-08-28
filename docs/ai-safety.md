# AI Safety Architecture

> ⚠️ **PORTFOLIO PROJECT** — These rules are for DEMO purposes. They are NOT a medically exhaustive or clinically validated rule set.

## Safety Design Principles

1. **AI assists, never decides** — All AI output is advisory and requires human clinician review
2. **Deterministic rules cannot be overridden by AI** — The safety engine only escalates, never downgrades
3. **Emergency cases bypass normal scheduling** — They are immediately routed to human review
4. **Every AI interaction is audited** — Full audit trail with model, tokens, latency, and retry count
5. **Fallback when AI fails** — Severity-based fallback triage with automatic human review flag

## Safety Pipeline

```
Patient Symptoms
      │
      ├──→ Quick Safety Pre-Scan (keywords only, runs before AI)
      │         │
      │    Emergency indicators?
      │         │
      ▼         ▼
   AI Triage ──→ Structured Output Validation
      │              │
      │         Valid JSON? Required fields? Correct enums?
      │              │
      │         ┌────┴────┐
      │         No        Yes
      │         │         │
      │    Retry (max 2)  │
      │         │         │
      │    Still fails?   │
      │         │         │
      │    Human Review   │
      │                   │
      └──────────────────►│
                          │
              Deterministic Safety Engine
                          │
              ┌───────────┼───────────┐
              │           │           │
           NORMAL      URGENT     EMERGENCY
              │           │           │
           Standard    Priority    HALT scheduling
           scheduling  scheduling  Staff notification
                                   Human review task
                                   Audit entry
```

## Emergency Keyword Patterns

| Category | Pattern Examples |
|---|---|
| Cardiac | chest pain, chest pressure, heart attack |
| Respiratory | severe difficulty breathing, can't breathe, choking |
| Neurological | stroke, loss of consciousness, seizure, worst headache |
| Hemorrhagic | severe bleeding, uncontrolled bleeding, coughing blood |
| Allergic | anaphylaxis, severe allergic reaction, throat swelling |
| Mental Health | suicidal, self-harm, want to end my life |
| Trauma | severe injury, major trauma |
| Toxicological | overdose, poisoning |

## AI Output Validation

Every AI triage output is validated against:
- Required fields: urgency, risk_score, specialty, summary, confidence, requires_human_review
- Enum validation: urgency must be EMERGENCY/URGENT/ROUTINE/NON_URGENT
- Range validation: risk_score (0-10), confidence (0-1)
- Specialty validation: must match database specialties
- Array validation: red_flags, clinician_review_points

## What AI Cannot Do

- ❌ Override deterministic safety rules
- ❌ Diagnose diseases
- ❌ Fabricate doctors or appointment slots
- ❌ Skip validation steps
- ❌ Silently continue with invalid output
- ❌ Make clinical decisions without human review
