import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { checkDbConnection } from "./db/client.js";
import { authRoutes } from "./routes/auth.js";
import { clientRoutes } from "./routes/clients.js";
import { assessmentRoutes } from "./routes/assessments.js";
import { reportRoutes } from "./routes/reports.js";

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "warn" : "info",
  },
});

// Plugins
await app.register(cors, {
  origin: process.env.APP_URL ?? "http://localhost:3000",
  credentials: true,
});

await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
});

// Routes
await app.register(authRoutes);
await app.register(clientRoutes);
await app.register(assessmentRoutes);
await app.register(reportRoutes);

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// Start
const port = Number(process.env.PORT ?? 3001);
try {
  await checkDbConnection();
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`BetterFly API running on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
