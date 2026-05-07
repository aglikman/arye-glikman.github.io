-- BetterFly Smart Clinical System — PostgreSQL Schema
-- Run via Drizzle migrations or directly against the database

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Clinics ──────────────────────────────────────────────────────────────────
CREATE TABLE clinics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  logo_url        TEXT,
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  default_language TEXT NOT NULL DEFAULT 'en',
  config          JSONB NOT NULL DEFAULT '{}',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('super_admin','clinic_admin','clinician','receptionist')),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret      TEXT,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clinic_id ON users(clinic_id);
CREATE INDEX idx_users_email ON users(email);

-- ─── Clients ──────────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  date_of_birth       DATE,
  email               TEXT,
  phone               TEXT,
  preferred_language  TEXT NOT NULL DEFAULT 'en',
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  assigned_clinician  UUID REFERENCES users(id),
  notes               TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_clinic_id ON clients(clinic_id);
CREATE INDEX idx_clients_assigned_clinician ON clients(assigned_clinician);

-- ─── Questionnaire Templates ──────────────────────────────────────────────────
CREATE TABLE questionnaire_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID REFERENCES clinics(id) ON DELETE CASCADE,
  name_en         TEXT NOT NULL,
  name_he         TEXT NOT NULL,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  schema          JSONB NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  cloned_from     UUID REFERENCES questionnaire_templates(id),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Assessments ──────────────────────────────────────────────────────────────
CREATE TABLE assessments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  template_id         UUID REFERENCES questionnaire_templates(id),
  assigned_clinician  UUID REFERENCES users(id),
  type                TEXT NOT NULL DEFAULT 'intake' CHECK (type IN ('intake','follow_up','qeeg')),
  language            TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','he')),
  status              TEXT NOT NULL DEFAULT 'invited'
                        CHECK (status IN ('invited','in_progress','submitted','scored','reviewed','report_generated')),
  invite_token        TEXT UNIQUE,
  invite_token_expiry TIMESTAMPTZ,
  invite_sent_at      TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  interval_days       INTEGER,
  follow_up_of        UUID REFERENCES assessments(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_client_id ON assessments(client_id);
CREATE INDEX idx_assessments_clinic_id ON assessments(clinic_id);
CREATE INDEX idx_assessments_invite_token ON assessments(invite_token);

-- ─── Assessment Responses ─────────────────────────────────────────────────────
CREATE TABLE assessment_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id     TEXT NOT NULL,
  domain          TEXT NOT NULL,
  value           JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_responses_assessment_id ON assessment_responses(assessment_id);

-- ─── Domain Scores ────────────────────────────────────────────────────────────
CREATE TABLE domain_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  domain          TEXT NOT NULL,
  total_score     INTEGER NOT NULL,
  severity        TEXT NOT NULL,
  color           TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_assessment_id ON domain_scores(assessment_id);
CREATE UNIQUE INDEX idx_scores_assessment_domain ON domain_scores(assessment_id, domain);

-- ─── Risk Alerts ──────────────────────────────────────────────────────────────
CREATE TABLE risk_alerts (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id           UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type                    TEXT NOT NULL,
  severity                TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  triggered_by_question   TEXT,
  note                    TEXT,
  acknowledged_by         UUID REFERENCES users(id),
  acknowledged_at         TIMESTAMPTZ,
  resolved_by             UUID REFERENCES users(id),
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_alerts_assessment_id ON risk_alerts(assessment_id);
CREATE INDEX idx_risk_alerts_client_id ON risk_alerts(client_id);
CREATE INDEX idx_risk_alerts_status ON risk_alerts(status);

-- ─── Interpretations ──────────────────────────────────────────────────────────
CREATE TABLE interpretations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id       UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  domain              TEXT,
  interpretation_data JSONB NOT NULL,
  executive_summary   TEXT,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ
);

CREATE INDEX idx_interpretations_assessment_id ON interpretations(assessment_id);

-- ─── QEEG Entries ─────────────────────────────────────────────────────────────
CREATE TABLE qeeg_entries (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id               UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  recording_date              DATE,
  equipment_used              TEXT,
  montage                     TEXT,
  eyes_open_status            TEXT,
  eyes_closed_status          TEXT,
  artifact_quality            TEXT,
  raw_eeg_notes               TEXT,
  main_findings               TEXT,
  clinical_considerations     TEXT,
  neurofeedback_planning      TEXT,
  follow_up_recommendation    TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Reports ──────────────────────────────────────────────────────────────────
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('intake','follow_up','qeeg','combined')),
  language        TEXT NOT NULL DEFAULT 'en',
  sections        JSONB NOT NULL DEFAULT '[]',
  clinician_notes TEXT,
  diagnostic_impression TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','preview','approved','sent')),
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  pdf_url         TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_assessment_id ON reports(assessment_id);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     UUID,
  details         JSONB DEFAULT '{}',
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_clinic_id ON audit_logs(clinic_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ─── Consent Versions ─────────────────────────────────────────────────────────
CREATE TABLE consent_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  content_en      TEXT NOT NULL,
  content_he      TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE client_consents (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assessment_id       UUID REFERENCES assessments(id),
  consent_version_id  UUID NOT NULL REFERENCES consent_versions(id),
  consented           BOOLEAN NOT NULL,
  ip_address          INET,
  consented_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Update trigger ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clinics_updated_at       BEFORE UPDATE ON clinics            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at       BEFORE UPDATE ON clients            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_templates_updated_at     BEFORE UPDATE ON questionnaire_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assessments_updated_at   BEFORE UPDATE ON assessments        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_qeeg_updated_at          BEFORE UPDATE ON qeeg_entries       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reports_updated_at       BEFORE UPDATE ON reports            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
