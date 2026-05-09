import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { LoginSchema } from "@betterfly/shared";
import { pool } from "../db/client.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const body = LoginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });
    }

    const { email, password } = body.data;

    const result = await pool.query(
      `SELECT id, clinic_id, email, password_hash, first_name, last_name, role, active
       FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        clinic_id: user.clinic_id,
      },
      { expiresIn: process.env.JWT_EXPIRY ?? "8h" }
    );

    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        clinic_id: user.clinic_id,
      },
    });
  });

  app.post("/auth/logout", async (_request, reply) => {
    return reply.send({ message: "Logged out" });
  });
}
