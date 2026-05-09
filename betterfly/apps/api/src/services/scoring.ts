import type {
  AssessmentResponse,
  ClinicalDomain,
  DomainScore,
  RiskAlert,
  RiskAlertType,
  ScoreOutput,
  Severity,
  SeverityColor,
} from "@betterfly/shared";

// ─── Severity Rules ───────────────────────────────────────────────────────────

type SeverityBreakpoint = { max: number; severity: Severity };

const SEVERITY_RULES: Record<ClinicalDomain, SeverityBreakpoint[]> = {
  anxiety: [
    { max: 4, severity: "minimal" },
    { max: 9, severity: "mild" },
    { max: 14, severity: "moderate" },
    { max: Infinity, severity: "severe" },
  ],
  mood: [
    { max: 4, severity: "minimal" },
    { max: 9, severity: "mild" },
    { max: 14, severity: "moderate" },
    { max: 19, severity: "moderately_severe" },
    { max: Infinity, severity: "severe" },
  ],
  sleep: [
    { max: 7, severity: "minimal" },
    { max: 14, severity: "mild" },
    { max: 21, severity: "moderate" },
    { max: Infinity, severity: "severe" },
  ],
  adhd: [
    { max: 9, severity: "minimal" },
    { max: 17, severity: "mild" },
    { max: 23, severity: "moderate" },
    { max: Infinity, severity: "severe" },
  ],
  trauma: [
    { max: 19, severity: "minimal" },
    { max: 39, severity: "mild" },
    { max: 59, severity: "moderate" },
    { max: Infinity, severity: "severe" },
  ],
  impairment: [
    { max: 3, severity: "minimal" },
    { max: 6, severity: "mild" },
    { max: 9, severity: "moderate" },
    { max: Infinity, severity: "severe" },
  ],
  // domains without direct severity scoring — handled separately
  cognitive:  [{ max: Infinity, severity: "minimal" }],
  learning:   [{ max: Infinity, severity: "minimal" }],
  substance:  [{ max: Infinity, severity: "minimal" }],
  medication: [{ max: Infinity, severity: "minimal" }],
  qeeg:       [{ max: Infinity, severity: "minimal" }],
};

const SEVERITY_COLOR: Record<Severity, SeverityColor> = {
  minimal: "green",
  mild: "yellow",
  moderate: "orange",
  moderately_severe: "red",
  severe: "red",
  critical: "dark_red",
};

// ─── Risk-trigger question IDs ────────────────────────────────────────────────

const RISK_TRIGGERS: Record<string, RiskAlertType> = {
  mood_009: "self_harm",
  mood_010: "suicidal_ideation",
  trauma_015: "homicidal_ideation",
};

// ─── Main Scoring Function ────────────────────────────────────────────────────

export function scoreAssessment(
  assessmentId: string,
  responses: AssessmentResponse[],
  domainMap: Record<string, ClinicalDomain>
): ScoreOutput {
  const domainTotals: Partial<Record<ClinicalDomain, number>> = {};
  const riskAlerts: RiskAlert[] = [];

  for (const response of responses) {
    const domain = domainMap[response.question_id];
    if (!domain) continue;

    const numericValue = typeof response.value === "number" ? response.value : 0;

    if (!(domain in domainTotals)) {
      domainTotals[domain] = 0;
    }
    domainTotals[domain]! += numericValue;

    const riskType = RISK_TRIGGERS[response.question_id];
    if (riskType && numericValue >= 1) {
      riskAlerts.push({
        type: riskType,
        severity: numericValue >= 2 ? "critical" : "high",
        status: "open",
        triggered_by_question: response.question_id,
      });
    }
  }

  const scores: Partial<Record<ClinicalDomain, DomainScore>> = {};

  for (const [domainKey, total] of Object.entries(domainTotals)) {
    const domain = domainKey as ClinicalDomain;
    const severity = computeSeverity(domain, total);
    scores[domain] = {
      total,
      severity,
      color: SEVERITY_COLOR[severity],
    };
  }

  if (scores.mood?.total !== undefined && scores.mood.total >= 15) {
    const existing = riskAlerts.find((a) => a.type === "severe_mood");
    if (!existing) {
      riskAlerts.push({ type: "severe_mood", severity: "high", status: "open" });
    }
  }

  return { assessment_id: assessmentId, scores, risk_alerts: riskAlerts };
}

function computeSeverity(domain: ClinicalDomain, score: number): Severity {
  const rules = SEVERITY_RULES[domain] ?? [{ max: Infinity, severity: "minimal" as Severity }];
  for (const rule of rules) {
    if (score <= rule.max) return rule.severity;
  }
  return "severe";
}

export function computeProgressLabel(
  baselineScore: number,
  currentScore: number
): string {
  if (baselineScore === 0) return "no_significant_change";
  const percentChange = ((baselineScore - currentScore) / baselineScore) * 100;
  if (percentChange >= 50) return "major_improvement";
  if (percentChange >= 30) return "meaningful_improvement";
  if (percentChange <= -20) return "clinical_worsening";
  return "no_significant_change";
}
