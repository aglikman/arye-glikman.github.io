import type { InterpretationOutput, Language, ReportSection, ReportType, ScoreOutput } from "@betterfly/shared";

export interface ReportBuildInput {
  type: ReportType;
  language: Language;
  client: { first_name: string; last_name: string; date_of_birth?: string };
  clinic: { name: string; logo_url?: string };
  clinician: { first_name: string; last_name: string };
  assessment: { submitted_at: string };
  scores: ScoreOutput;
  interpretation: InterpretationOutput;
  clinician_notes?: string;
  diagnostic_impression?: string;
}

const SECTION_TITLES: Record<string, { en: string; he: string }> = {
  header:               { en: "Assessment Report",          he: "דוח הערכה" },
  client_info:          { en: "Client Information",         he: "פרטי מטופל" },
  score_summary:        { en: "Symptom Score Summary",      he: "סיכום ציונים" },
  executive_summary:    { en: "Executive Summary",          he: "סיכום מנהלים" },
  domain_interpretations: { en: "Domain Interpretations",  he: "פירוש לפי תחום" },
  risk_alerts:          { en: "Risk Alerts",                he: "דגלים אדומים" },
  medication_summary:   { en: "Medication & Substance Use", he: "תרופות וחומרים" },
  clinician_notes:      { en: "Clinician Notes",            he: "הערות קלינאי" },
  diagnostic_impression:{ en: "Diagnostic Impression",      he: "רושם דיאגנוסטי" },
  recommendations:      { en: "Recommendations",            he: "המלצות" },
  disclaimer:           { en: "Clinical Disclaimer",        he: "הצהרת אחריות קלינית" },
};

export function buildReportSections(input: ReportBuildInput): ReportSection[] {
  const lang = input.language;
  const sections: ReportSection[] = [];
  let order = 1;

  const addSection = (
    id: string,
    generatedText: string,
    locked = false
  ): void => {
    sections.push({
      id,
      title: SECTION_TITLES[id] ?? { en: id, he: id },
      generated_text: generatedText,
      clinician_text: "",
      locked,
      order: order++,
      visible: true,
    });
  };

  // Header
  addSection(
    "header",
    lang === "he"
      ? `${input.clinic.name} | ${input.clinician.first_name} ${input.clinician.last_name} | ${formatDate(input.assessment.submitted_at)}`
      : `${input.clinic.name} | ${input.clinician.first_name} ${input.clinician.last_name} | ${formatDate(input.assessment.submitted_at)}`,
    true
  );

  // Client info
  const age = input.client.date_of_birth ? computeAge(input.client.date_of_birth) : null;
  addSection(
    "client_info",
    lang === "he"
      ? `שם: ${input.client.first_name} ${input.client.last_name}${age ? ` | גיל: ${age}` : ""} | תאריך הגשה: ${formatDate(input.assessment.submitted_at)}`
      : `Name: ${input.client.first_name} ${input.client.last_name}${age ? ` | Age: ${age}` : ""} | Submitted: ${formatDate(input.assessment.submitted_at)}`,
    true
  );

  // Score summary table (serialized as structured text for now; PDF renderer will format)
  const scoreLines = Object.entries(input.scores.scores)
    .map(([domain, score]) => {
      if (!score) return "";
      return lang === "he"
        ? `${domain}: ${score.total} — ${translateSeverity(score.severity, lang)}`
        : `${domain}: ${score.total} — ${score.severity.replace("_", " ")}`;
    })
    .filter(Boolean)
    .join("\n");
  addSection("score_summary", scoreLines, true);

  // Executive summary
  addSection("executive_summary", input.interpretation.executive_summary);

  // Domain interpretations
  const domainText = input.interpretation.domain_interpretations
    .map((d) => `[${d.domain.toUpperCase()}] ${d.interpretation_text}`)
    .join("\n\n");
  addSection("domain_interpretations", domainText);

  // Risk alerts
  const alertText =
    input.scores.risk_alerts.length === 0
      ? lang === "he" ? "לא זוהו דגלים אדומים בהגשה זו." : "No risk alerts identified in this submission."
      : input.scores.risk_alerts
          .map((a) => `• ${a.type.replace("_", " ")} — ${a.severity.toUpperCase()} [${a.status}]`)
          .join("\n");
  addSection("risk_alerts", alertText, true);

  // Clinician notes (editable, seeded with provided text)
  sections.push({
    id: "clinician_notes",
    title: SECTION_TITLES.clinician_notes,
    generated_text: "",
    clinician_text: input.clinician_notes ?? "",
    locked: false,
    order: order++,
    visible: true,
  });

  // Diagnostic impression
  sections.push({
    id: "diagnostic_impression",
    title: SECTION_TITLES.diagnostic_impression,
    generated_text: "",
    clinician_text: input.diagnostic_impression ?? "",
    locked: false,
    order: order++,
    visible: true,
  });

  // Disclaimer
  addSection("disclaimer", input.interpretation.disclaimer, true);

  return sections;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB");
}

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function translateSeverity(severity: string, lang: Language): string {
  if (lang !== "he") return severity.replace("_", " ");
  const map: Record<string, string> = {
    minimal: "מינימלי",
    mild: "קל",
    moderate: "בינוני",
    moderately_severe: "בינוני-חמור",
    severe: "חמור",
    critical: "קריטי",
  };
  return map[severity] ?? severity;
}
