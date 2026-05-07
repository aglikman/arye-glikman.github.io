import type {
  ClinicalDomain,
  DomainInterpretation,
  DomainScore,
  InterpretationOutput,
  Severity,
} from "@betterfly/shared";

const DISCLAIMER =
  "These findings are based on self-report screening questionnaires. They represent screening data only and do not constitute a clinical diagnosis. All results require clinical interview and professional judgment before any diagnostic conclusions are drawn.";

// ─── Domain-level interpretation templates ─────────────────────────────────────

type InterpretationTemplate = {
  text: (severity: Severity, score: number) => string;
  follow_up: string[];
};

const TEMPLATES: Partial<Record<ClinicalDomain, InterpretationTemplate>> = {
  anxiety: {
    text: (severity, score) =>
      `Anxiety symptoms fall in the ${severity.replace("_", " ")} range (score ${score}). Findings may be consistent with generalized anxiety presentation. Clinical interview is required to evaluate duration, functional impact, and differential diagnoses.`,
    follow_up: [
      "Clarify onset, duration, and triggers of anxiety symptoms",
      "Assess for panic disorder, social anxiety, or specific phobias",
      "Screen for co-occurring mood disorder",
      "Review medical contributors (thyroid, cardiac, stimulant use)",
    ],
  },
  mood: {
    text: (severity, score) =>
      `Depressive symptoms fall in the ${severity.replace("_", " ")} range (score ${score}). Findings may be consistent with a depressive episode. Clinical interview is required to assess duration, functional impairment, and safety.`,
    follow_up: [
      "Clarify safety and protective factors",
      "Assess prior depressive episodes and treatment history",
      "Screen for bipolar spectrum history",
      "Review medication and medical contributors",
      "Evaluate sleep, appetite, and concentration changes",
    ],
  },
  sleep: {
    text: (severity, score) =>
      `Sleep difficulties fall in the ${severity.replace("_", " ")} range (score ${score}). Findings may be consistent with insomnia or sleep disruption. Clinical interview is required to assess sleep architecture, hygiene, and associated conditions.`,
    follow_up: [
      "Clarify sleep onset versus maintenance difficulty",
      "Screen for sleep apnea or restless legs syndrome",
      "Assess caffeine, substance, and medication effects",
      "Evaluate relationship between sleep and mood/anxiety symptoms",
    ],
  },
  adhd: {
    text: (severity, score) =>
      `Attention and executive function symptoms fall in the ${severity.replace("_", " ")} range (score ${score}). Findings may be consistent with an attentional presentation. Clinical interview, history, and collateral information are required before any ADHD-related conclusions.`,
    follow_up: [
      "Gather developmental and school history",
      "Assess for inattentive versus combined presentation",
      "Screen for anxiety or mood contributions to attention difficulties",
      "Review prior evaluations or psychometric testing",
    ],
  },
  trauma: {
    text: (severity, score) =>
      `Trauma-related symptom burden falls in the ${severity.replace("_", " ")} range (score ${score}). Findings may be consistent with post-traumatic stress. Clinical interview is required to assess trauma history, current symptom pattern, and safety.`,
    follow_up: [
      "Explore trauma history with sensitivity and pacing",
      "Assess avoidance, hyperarousal, and intrusive symptom clusters",
      "Screen for dissociation and complex trauma presentation",
      "Evaluate current safety and support systems",
    ],
  },
  impairment: {
    text: (severity, score) =>
      `Functional impairment falls in the ${severity.replace("_", " ")} range (score ${score}). Multiple life domains appear to be affected. Clinician should explore which areas are most impacted and their relationship to other symptom domains.`,
    follow_up: [
      "Clarify occupational, academic, or relational domains most affected",
      "Assess duration of functional decline",
      "Identify supports and coping strategies currently in use",
    ],
  },
};

// ─── Main interpretation function ─────────────────────────────────────────────

export function generateInterpretation(
  clientId: string,
  assessmentId: string,
  scores: Partial<Record<ClinicalDomain, DomainScore>>,
  symptomCountsAbove2: Partial<Record<ClinicalDomain, number>> = {}
): InterpretationOutput {
  const domain_interpretations: DomainInterpretation[] = [];

  for (const [domainKey, score] of Object.entries(scores)) {
    const domain = domainKey as ClinicalDomain;
    if (!score) continue;

    const template = TEMPLATES[domain];
    const interpretationText = template
      ? template.text(score.severity, score.total)
      : `Findings for ${domain} fall in the ${score.severity.replace("_", " ")} range (score ${score.total}). Clinical review is required.`;

    const followUp = template?.follow_up ?? ["Review findings with clinical interview"];

    domain_interpretations.push({
      domain,
      total_score: score.total,
      severity: score.severity,
      symptom_count_score_2_or_3: symptomCountsAbove2[domain] ?? 0,
      duration_met: null,
      functional_impairment_met: scores.impairment
        ? scores.impairment.severity !== "minimal"
        : false,
      risk_flag: score.severity === "severe" || score.severity === "critical" || score.severity === "moderately_severe",
      dsm_pattern_possible: score.severity !== "minimal",
      interpretation_text: interpretationText,
      clinician_follow_up_questions: followUp,
    });
  }

  const executiveSummary = buildExecutiveSummary(domain_interpretations);

  return {
    client_id: clientId,
    assessment_id: assessmentId,
    domain_interpretations,
    executive_summary: executiveSummary,
    generated_at: new Date().toISOString(),
    disclaimer: DISCLAIMER,
  };
}

function buildExecutiveSummary(interpretations: DomainInterpretation[]): string {
  const elevated = interpretations.filter(
    (i) => i.severity !== "minimal" && i.severity !== "mild"
  );

  if (elevated.length === 0) {
    return "Screening results do not indicate elevated symptom burden across assessed domains. Clinical interview should confirm these findings and address any areas of concern not captured by questionnaire.";
  }

  const domainList = elevated.map((i) => `${i.domain} (${i.severity.replace("_", " ")})`).join(", ");
  const riskDomains = interpretations.filter((i) => i.risk_flag);

  let summary = `Screening results indicate elevated symptom burden across the following domains: ${domainList}. `;

  if (riskDomains.length > 0) {
    summary += `Risk flags were identified and require immediate clinical attention. `;
  }

  summary +=
    "These findings require clinical interview, professional judgment, and consideration of the client's full history before any diagnostic conclusions are drawn. This screening does not constitute a diagnosis.";

  return summary;
}
