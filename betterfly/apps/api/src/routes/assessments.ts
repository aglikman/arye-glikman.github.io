import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { AssessmentSubmissionSchema } from "@betterfly/shared";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db/client.js";
import { scoreAssessment } from "../services/scoring.js";
import { generateInterpretation } from "../services/interpretation.js";
import type { ClinicalDomain } from "@betterfly/shared";

const CreateAssessmentSchema = z.object({
  client_id: z.string().uuid(),
  template_id: z.string().uuid().optional(),
  type: z.enum(["intake", "follow_up", "qeeg"]).default("intake"),
  language: z.enum(["en", "he"]).default("en"),
  follow_up_of: z.string().uuid().optional(),
  interval_days: z.number().optional(),
});

export async function assessmentRoutes(app: FastifyInstance): Promise<void> {
  // Create assessment and generate invite token
  app.post("/assessments", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id, sub: clinician_id } = request.user;
    const body = CreateAssessmentSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });

    const d = body.data;
    const invite_token = uuidv4().replace(/-/g, "");
    const expiry = new Date(Date.now() + Number(process.env.CLINIC_INTAKE_TOKEN_EXPIRY_HOURS ?? 72) * 3_600_000);

    const result = await pool.query(
      `INSERT INTO assessments (client_id, clinic_id, template_id, assigned_clinician,
        type, language, status, invite_token, invite_token_expiry, follow_up_of, interval_days)
       VALUES ($1,$2,$3,$4,$5,$6,'invited',$7,$8,$9,$10)
       RETURNING *`,
      [d.client_id, clinic_id, d.template_id ?? null, clinician_id,
       d.type, d.language, invite_token, expiry,
       d.follow_up_of ?? null, d.interval_days ?? null]
    );

    return reply.code(201).send({
      ...result.rows[0],
      intake_url: `${process.env.APP_URL}/intake/${invite_token}`,
    });
  });

  // Public: fetch assessment by invite token (no auth)
  app.get("/intake/:token", async (request, reply) => {
    const { token } = request.params as { token: string };

    const result = await pool.query(
      `SELECT a.id, a.type, a.language, a.status, a.invite_token_expiry, a.template_id,
              c.first_name, c.last_name, c.preferred_language,
              qt.schema AS template_schema,
              cv.content_en, cv.content_he
       FROM assessments a
       JOIN clients c ON c.id = a.client_id
       LEFT JOIN questionnaire_templates qt ON qt.id = a.template_id
       LEFT JOIN consent_versions cv ON cv.clinic_id = a.clinic_id AND cv.active = TRUE
       WHERE a.invite_token = $1`,
      [token]
    );

    const row = result.rows[0];
    if (!row) return reply.code(404).send({ error: "Invalid or expired link" });
    if (row.status === "submitted" || row.status === "scored") {
      return reply.code(410).send({ error: "Assessment already submitted" });
    }
    if (new Date(row.invite_token_expiry) < new Date()) {
      return reply.code(410).send({ error: "Invitation link has expired" });
    }

    await pool.query(
      `UPDATE assessments SET status = 'in_progress', started_at = NOW() WHERE invite_token = $1 AND status = 'invited'`,
      [token]
    );

    return reply.send(row);
  });

  // Public: submit assessment responses
  app.post("/intake/:token/submit", async (request, reply) => {
    const { token } = request.params as { token: string };

    const assessmentResult = await pool.query(
      `SELECT a.id, a.client_id, a.clinic_id, a.template_id, a.status, a.invite_token_expiry
       FROM assessments a WHERE a.invite_token = $1`,
      [token]
    );

    const assessment = assessmentResult.rows[0];
    if (!assessment) return reply.code(404).send({ error: "Invalid link" });
    if (assessment.status === "submitted") return reply.code(409).send({ error: "Already submitted" });
    if (new Date(assessment.invite_token_expiry) < new Date()) {
      return reply.code(410).send({ error: "Link expired" });
    }

    const body = AssessmentSubmissionSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid submission", issues: body.error.issues });

    const { responses } = body.data;

    // Fetch domain map from template
    const tmplResult = await pool.query(
      `SELECT schema FROM questionnaire_templates WHERE id = $1`,
      [assessment.template_id]
    );
    const template = tmplResult.rows[0]?.schema;
    const domainMap: Record<string, ClinicalDomain> = {};
    if (template?.questions) {
      for (const q of template.questions) {
        domainMap[q.question_id] = q.domain;
      }
    }

    // Store responses
    const insertValues = responses.map((r) =>
      pool.query(
        `INSERT INTO assessment_responses (assessment_id, question_id, domain, value)
         VALUES ($1,$2,$3,$4)`,
        [assessment.id, r.question_id, domainMap[r.question_id] ?? "unknown", JSON.stringify(r.value)]
      )
    );
    await Promise.all(insertValues);

    // Mark submitted
    await pool.query(
      `UPDATE assessments SET status = 'submitted', submitted_at = NOW() WHERE id = $1`,
      [assessment.id]
    );

    // Score
    const scoreOutput = scoreAssessment(assessment.id, responses, domainMap);

    // Store scores
    for (const [domain, score] of Object.entries(scoreOutput.scores)) {
      if (!score) continue;
      await pool.query(
        `INSERT INTO domain_scores (assessment_id, domain, total_score, severity, color, metadata)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (assessment_id, domain) DO UPDATE
         SET total_score=$3, severity=$4, color=$5, metadata=$6`,
        [assessment.id, domain, score.total, score.severity, score.color, JSON.stringify(score)]
      );
    }

    // Store risk alerts
    for (const alert of scoreOutput.risk_alerts) {
      await pool.query(
        `INSERT INTO risk_alerts (assessment_id, client_id, type, severity, status, triggered_by_question)
         VALUES ($1,$2,$3,$4,'open',$5)`,
        [assessment.id, assessment.client_id, alert.type, alert.severity, alert.triggered_by_question ?? null]
      );
    }

    // Generate interpretation
    const interpretation = generateInterpretation(assessment.client_id, assessment.id, scoreOutput.scores);
    await pool.query(
      `INSERT INTO interpretations (assessment_id, interpretation_data, executive_summary, generated_at)
       VALUES ($1,$2,$3,NOW())`,
      [assessment.id, JSON.stringify(interpretation), interpretation.executive_summary]
    );

    // Mark scored
    await pool.query(`UPDATE assessments SET status = 'scored' WHERE id = $1`, [assessment.id]);

    return reply.send({ message: "Submission received", assessment_id: assessment.id });
  });

  // Clinician: get scored assessment dashboard data
  app.get("/assessments/:id/dashboard", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id } = request.user;
    const { id } = request.params as { id: string };

    const [assessmentRes, scoresRes, alertsRes, interpretRes] = await Promise.all([
      pool.query(
        `SELECT a.*, c.first_name, c.last_name, c.date_of_birth
         FROM assessments a JOIN clients c ON c.id = a.client_id
         WHERE a.id = $1 AND a.clinic_id = $2`,
        [id, clinic_id]
      ),
      pool.query(`SELECT * FROM domain_scores WHERE assessment_id = $1`, [id]),
      pool.query(`SELECT * FROM risk_alerts WHERE assessment_id = $1`, [id]),
      pool.query(`SELECT * FROM interpretations WHERE assessment_id = $1 LIMIT 1`, [id]),
    ]);

    const assessment = assessmentRes.rows[0];
    if (!assessment) return reply.code(404).send({ error: "Assessment not found" });

    return reply.send({
      client: {
        id: assessment.client_id,
        display_name: `${assessment.first_name} ${assessment.last_name}`,
        date_of_birth: assessment.date_of_birth,
      },
      assessment: {
        id: assessment.id,
        type: assessment.type,
        language: assessment.language,
        status: assessment.status,
        submitted_at: assessment.submitted_at,
      },
      score_cards: scoresRes.rows.map((s) => ({
        domain: s.domain,
        score: s.total_score,
        severity: s.severity,
        color: s.color,
        metadata: s.metadata,
      })),
      alerts: alertsRes.rows,
      interpretation: interpretRes.rows[0]?.interpretation_data ?? null,
      executive_summary: interpretRes.rows[0]?.executive_summary ?? "",
    });
  });
}
