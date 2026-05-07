import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db/client.js";
import { buildReportSections } from "../services/report.js";
import type { Language, ReportType } from "@betterfly/shared";

const CreateReportSchema = z.object({
  type: z.enum(["intake", "follow_up", "qeeg", "combined"]).default("intake"),
  language: z.enum(["en", "he"]).default("en"),
  clinician_notes: z.string().optional(),
  diagnostic_impression: z.string().optional(),
});

const UpdateReportSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      clinician_text: z.string(),
      visible: z.boolean().optional(),
    })
  ).optional(),
  clinician_notes: z.string().optional(),
  diagnostic_impression: z.string().optional(),
});

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.post("/assessments/:id/reports", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id, sub: clinician_id } = request.user;
    const { id: assessment_id } = request.params as { id: string };
    const body = CreateReportSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid input" });

    // Fetch all needed data
    const [assessmentRes, scoresRes, alertsRes, interpretRes, clinicRes, clinicianRes] =
      await Promise.all([
        pool.query(
          `SELECT a.*, c.first_name, c.last_name, c.date_of_birth, c.id as client_id
           FROM assessments a JOIN clients c ON c.id = a.client_id
           WHERE a.id = $1 AND a.clinic_id = $2`,
          [assessment_id, clinic_id]
        ),
        pool.query(`SELECT * FROM domain_scores WHERE assessment_id = $1`, [assessment_id]),
        pool.query(`SELECT * FROM risk_alerts WHERE assessment_id = $1`, [assessment_id]),
        pool.query(`SELECT * FROM interpretations WHERE assessment_id = $1 LIMIT 1`, [assessment_id]),
        pool.query(`SELECT name, logo_url FROM clinics WHERE id = $1`, [clinic_id]),
        pool.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [clinician_id]),
      ]);

    const assessment = assessmentRes.rows[0];
    if (!assessment) return reply.code(404).send({ error: "Assessment not found" });

    const interpretation = interpretRes.rows[0]?.interpretation_data;
    if (!interpretation) return reply.code(409).send({ error: "Assessment not yet scored" });

    const scores = {
      assessment_id,
      scores: Object.fromEntries(scoresRes.rows.map((s) => [s.domain, s])),
      risk_alerts: alertsRes.rows,
    };

    const sections = buildReportSections({
      type: body.data.type as ReportType,
      language: body.data.language as Language,
      client: {
        first_name: assessment.first_name,
        last_name: assessment.last_name,
        date_of_birth: assessment.date_of_birth,
      },
      clinic: clinicRes.rows[0],
      clinician: clinicianRes.rows[0],
      assessment: { submitted_at: assessment.submitted_at },
      scores: scores as any,
      interpretation,
      clinician_notes: body.data.clinician_notes,
      diagnostic_impression: body.data.diagnostic_impression,
    });

    const result = await pool.query(
      `INSERT INTO reports (assessment_id, client_id, clinic_id, type, language, sections,
        clinician_notes, diagnostic_impression, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft')
       RETURNING *`,
      [assessment_id, assessment.client_id, clinic_id, body.data.type, body.data.language,
       JSON.stringify(sections), body.data.clinician_notes ?? null,
       body.data.diagnostic_impression ?? null]
    );

    return reply.code(201).send(result.rows[0]);
  });

  app.get("/reports/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id } = request.user;
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT * FROM reports WHERE id = $1 AND clinic_id = $2`,
      [id, clinic_id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "Report not found" });
    return reply.send(result.rows[0]);
  });

  app.patch("/reports/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id } = request.user;
    const { id } = request.params as { id: string };
    const body = UpdateReportSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid input" });

    const existing = await pool.query(
      `SELECT sections FROM reports WHERE id = $1 AND clinic_id = $2`,
      [id, clinic_id]
    );
    if (!existing.rows[0]) return reply.code(404).send({ error: "Report not found" });

    let sections = existing.rows[0].sections;
    if (body.data.sections) {
      for (const patch of body.data.sections) {
        const sec = sections.find((s: { id: string }) => s.id === patch.id);
        if (sec && !sec.locked) {
          if (patch.clinician_text !== undefined) sec.clinician_text = patch.clinician_text;
          if (patch.visible !== undefined) sec.visible = patch.visible;
        }
      }
    }

    const result = await pool.query(
      `UPDATE reports SET sections = $3, clinician_notes = COALESCE($4, clinician_notes),
        diagnostic_impression = COALESCE($5, diagnostic_impression), updated_at = NOW()
       WHERE id = $1 AND clinic_id = $2 RETURNING *`,
      [id, clinic_id, JSON.stringify(sections),
       body.data.clinician_notes ?? null, body.data.diagnostic_impression ?? null]
    );
    return reply.send(result.rows[0]);
  });

  app.post("/reports/:id/approve", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id, sub: user_id } = request.user;
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `UPDATE reports SET status = 'approved', approved_by = $3, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND clinic_id = $2 RETURNING *`,
      [id, clinic_id, user_id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "Report not found" });
    return reply.send(result.rows[0]);
  });
}
