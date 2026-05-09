import type { FastifyReply, FastifyRequest } from "fastify";
import type { TokenPayload } from "@betterfly/shared";

declare module "fastify" {
  interface FastifyRequest {
    user: TokenPayload;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: TokenPayload["role"][]): (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void> {
  return async (request, reply) => {
    await requireAuth(request, reply);
    if (!roles.includes(request.user.role)) {
      reply.code(403).send({ error: "Forbidden" });
    }
  };
}
