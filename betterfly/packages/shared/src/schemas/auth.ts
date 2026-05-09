import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: z.enum(["clinic_admin", "clinician", "receptionist"]),
  clinic_id: z.string().uuid(),
});

export const TokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["super_admin", "clinic_admin", "clinician", "receptionist"]),
  clinic_id: z.string().uuid(),
  iat: z.number(),
  exp: z.number(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;
