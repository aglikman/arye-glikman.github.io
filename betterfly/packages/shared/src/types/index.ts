// ─── Roles ───────────────────────────────────────────────────────────────────

export type UserRole = "super_admin" | "clinic_admin" | "clinician" | "receptionist";

// ─── Language ────────────────────────────────────────────────────────────────

export type Language = "en" | "he";

// ─── Clinical Domains ────────────────────────────────────────────────────────

export type ClinicalDomain =
  | "anxiety"
  | "mood"
  | "sleep"
  | "cognitive"
  | "learning"
  | "adhd"
  | "trauma"
  | "substance"
  | "medication"
  | "impairment"
  | "qeeg";

// ─── Severity ────────────────────────────────────────────────────────────────

export type Severity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe" | "critical";

export type SeverityColor = "green" | "yellow" | "orange" | "red" | "dark_red";

export const SEVERITY_COLOR_MAP: Record<Severity, SeverityColor> = {
  minimal: "green",
  mild: "yellow",
  moderate: "orange",
  moderately_severe: "red",
  severe: "red",
  critical: "dark_red",
};

// ─── Response Types ───────────────────────────────────────────────────────────

export type ResponseType =
  | "scale_0_3"
  | "scale_0_4"
  | "yes_no"
  | "multiple_choice"
  | "text"
  | "date"
  | "medication_table"
  | "number";

// ─── Questionnaire ────────────────────────────────────────────────────────────

export interface LocalizedText {
  en: string;
  he: string;
}

export interface ResponseOption {
  value: number | string | boolean;
  label: LocalizedText;
}

export interface Question {
  question_id: string;
  domain: ClinicalDomain;
  subdomain?: string;
  text: LocalizedText;
  response_type: ResponseType;
  options?: ResponseOption[];
  dsm_tags: string[];
  required: boolean;
  risk_trigger: boolean;
  follow_up_enabled: boolean;
  display_condition?: DisplayCondition;
}

export interface DisplayCondition {
  question_id: string;
  operator: "eq" | "gte" | "lte" | "in";
  value: number | string | (number | string)[];
}

export interface QuestionnaireTemplate {
  template_id: string;
  version: string;
  name: LocalizedText;
  languages: Language[];
  default_language: Language;
  domains: ClinicalDomain[];
  questions: Question[];
  created_at: string;
  updated_at: string;
}

// ─── Assessment ───────────────────────────────────────────────────────────────

export type AssessmentType = "intake" | "follow_up" | "qeeg";
export type AssessmentStatus = "invited" | "in_progress" | "submitted" | "scored" | "reviewed" | "report_generated";

export interface MedicationEntry {
  name: string;
  dosage: string;
  frequency: string;
  indication: string;
}

export type ResponseValue = number | string | boolean | MedicationEntry[];

export interface AssessmentResponse {
  question_id: string;
  value: ResponseValue;
}

export interface AssessmentSubmission {
  assessment_id: string;
  client_id: string;
  language: Language;
  submitted_at: string;
  responses: AssessmentResponse[];
}

// ─── Scores ───────────────────────────────────────────────────────────────────

export interface DomainScore {
  total: number;
  severity: Severity;
  color: SeverityColor;
  criteria_count?: number;
  self_harm?: boolean;
  frequency_met?: boolean;
  duration_met?: boolean;
  presentation_hint?: string;
  inattention?: number;
  impulsivity?: number;
}

export interface ScoreOutput {
  assessment_id: string;
  scores: Partial<Record<ClinicalDomain, DomainScore>>;
  risk_alerts: RiskAlert[];
}

// ─── Risk Alerts ──────────────────────────────────────────────────────────────

export type RiskAlertType =
  | "self_harm"
  | "suicidal_ideation"
  | "homicidal_ideation"
  | "severe_mood"
  | "psychosis_flag"
  | "substance_crisis";

export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface RiskAlert {
  type: RiskAlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  triggered_by_question?: string;
  note?: string;
}

// ─── DSM Interpretation ───────────────────────────────────────────────────────

export interface DomainInterpretation {
  domain: ClinicalDomain;
  total_score: number;
  severity: Severity;
  symptom_count_score_2_or_3: number;
  duration_met: boolean | null;
  functional_impairment_met: boolean;
  risk_flag: boolean;
  dsm_pattern_possible: boolean;
  interpretation_text: string;
  clinician_follow_up_questions: string[];
}

export interface InterpretationOutput {
  client_id: string;
  assessment_id: string;
  domain_interpretations: DomainInterpretation[];
  executive_summary: string;
  generated_at: string;
  disclaimer: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface ScoreCard {
  domain: ClinicalDomain;
  label: LocalizedText;
  score: number;
  max_score: number;
  severity: Severity;
  color: SeverityColor;
  interpretation_preview: string;
}

export interface ProgressPoint {
  date: string;
  assessment_id: string;
  anxiety?: number;
  mood?: number;
  sleep?: number;
  attention?: number;
  impairment?: number;
}

export interface DashboardData {
  client: {
    id: string;
    display_name: string;
    age?: number;
  };
  assessment: {
    id: string;
    type: AssessmentType;
    language: Language;
    submitted_at: string;
    status: AssessmentStatus;
  };
  score_cards: ScoreCard[];
  alerts: RiskAlert[];
  charts: {
    current_domains: { domain: ClinicalDomain; score: number }[];
    timeline: ProgressPoint[];
  };
  executive_summary: string;
  report_status: "not_started" | "preview_available" | "approved" | "sent";
}

// ─── Report ───────────────────────────────────────────────────────────────────

export type ReportType = "intake" | "follow_up" | "qeeg" | "combined";

export interface ReportSection {
  id: string;
  title: LocalizedText;
  generated_text: string;
  clinician_text: string;
  locked: boolean;
  order: number;
  visible: boolean;
}

export interface ReportData {
  report_id: string;
  client_id: string;
  assessment_id: string;
  type: ReportType;
  language: Language;
  sections: ReportSection[];
  approved: boolean;
  approved_by?: string;
  approved_at?: string;
  pdf_url?: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export type ClientStatus = "active" | "inactive" | "archived";

export interface ClientProfile {
  client_id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  email?: string;
  phone?: string;
  preferred_language: Language;
  status: ClientStatus;
  created_at: string;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface ProgressSummary {
  baseline_assessment_id: string;
  current_assessment_id: string;
  domain: ClinicalDomain;
  baseline_score: number;
  current_score: number;
  percent_change: number;
  progress_label: "meaningful_improvement" | "major_improvement" | "no_significant_change" | "clinical_worsening";
}
