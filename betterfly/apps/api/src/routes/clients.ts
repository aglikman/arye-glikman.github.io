import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db/client.js";

const CreateClientSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  preferred_language: z.enum(["en", "he"]).default("en"),
  assigned_clinician: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function clientRoutes(app: FastifyInstance): Promise<void> {
  app.get("/clients", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id } = request.user;
    const result = await pool.query(
      `SELECT c.id, c.first_name, c.last_name, c.date_of_birth, c.email,
              c.preferred_language, c.status, c.created_at,
              u.first_name AS clinician_first, u.last_name AS clinician_last
       FROM clients c
       LEFT JOIN users u ON u.id = c.assigned_clinician
       WHERE c.clinic_id = $1 AND c.status != 'archived'
       ORDER BY c.created_at DESC`,
      [clinic_id]
    );
    return reply.send(result.rows);
  });

  app.get("/clients/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id } = request.user;
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT c.*, u.first_name AS clinician_first, u.last_name AS clinician_last
       FROM clients c
       LEFT JOIN users u ON u.id = c.assigned_clinician
       WHERE c.id = $1 AND c.clinic_id = $2`,
      [id, clinic_id]
    );

    if (!result.rows[0]) return reply.code(404).send({ error: "Client not found" });
    return reply.send(result.rows[0]);
  });

  app.post("/clients", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id, sub: created_by } = request.user;
    const body = CreateClientSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });

    const d = body.data;
    const result = await pool.query(
      `INSERT INTO clients (clinic_id, first_name, last_name, date_of_birth, email, phone,
        preferred_language, assigned_clinician, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [clinic_id, d.first_name, d.last_name, d.date_of_birth ?? null,
       d.email ?? null, d.phone ?? null, d.preferred_language,
       d.assigned_clinician ?? null, d.notes ?? null, created_by]
    );

    return reply.code(201).send(result.rows[0]);
  });

  app.patch("/clients/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id } = request.user;
    const { id } = request.params as { id: string };
    const body = CreateClientSchema.partial().safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });

    const fields = Object.entries(body.data)
      .filter(([, v]) => v !== undefined)
      .map(([k], i) => `${k} = $${i + 3}`)
      .join(", ");

    if (!fields) return reply.code(400).send({ error: "No fields to update" });

    const values = Object.values(body.data).filter((v) => v !== undefined);
    const result = await pool.query(
      `UPDATE clients SET ${fields}, updated_at = NOW() WHERE id = $1 AND clinic_id = $2 RETURNING *`,
      [id, clinic_id, ...values]
    );

    if (!result.rows[0]) return reply.code(404).send({ error: "Client not found" });
    return reply.send(result.rows[0]);
  });

  // List assessments for a client
  app.get("/clients/:id/assessments", { preHandler: requireAuth }, async (request, reply) => {
    const { clinic_id } = request.user;
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT a.id, a.type, a.language, a.status, a.submitted_at, a.created_at
       FROM assessments a
       WHERE a.client_id = $1 AND a.clinic_id = $2
       ORDER BY a.created_at DESC`,
      [id, clinic_id]
    );
    return reply.send(result.rows);
  });
}
