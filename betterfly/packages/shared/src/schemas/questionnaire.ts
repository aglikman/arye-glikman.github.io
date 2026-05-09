import { z } from "zod";

export const LocalizedTextSchema = z.object({
  en: z.string().min(1),
  he: z.string().min(1),
});

export const ResponseOptionSchema = z.object({
  value: z.union([z.number(), z.string(), z.boolean()]),
  label: LocalizedTextSchema,
});

export const DisplayConditionSchema = z.object({
  question_id: z.string(),
  operator: z.enum(["eq", "gte", "lte", "in"]),
  value: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]),
});

export const QuestionSchema = z.object({
  question_id: z.string(),
  domain: z.enum(["anxiety", "mood", "sleep", "cognitive", "learning", "adhd", "trauma", "substance", "medication", "impairment", "qeeg"]),
  subdomain: z.string().optional(),
  text: LocalizedTextSchema,
  response_type: z.enum(["scale_0_3", "scale_0_4", "yes_no", "multiple_choice", "text", "date", "medication_table", "number"]),
  options: z.array(ResponseOptionSchema).optional(),
  dsm_tags: z.array(z.string()),
  required: z.boolean(),
  risk_trigger: z.boolean(),
  follow_up_enabled: z.boolean(),
  display_condition: DisplayConditionSchema.optional(),
});

export const QuestionnaireTemplateSchema = z.object({
  template_id: z.string().uuid(),
  version: z.string(),
  name: LocalizedTextSchema,
  languages: z.array(z.enum(["en", "he"])),
  default_language: z.enum(["en", "he"]),
  domains: z.array(z.string()),
  questions: z.array(QuestionSchema),
});

export const MedicationEntrySchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  indication: z.string(),
});

export const AssessmentResponseSchema = z.object({
  question_id: z.string(),
  value: z.union([z.number(), z.string(), z.boolean(), z.array(MedicationEntrySchema)]),
});

export const AssessmentSubmissionSchema = z.object({
  assessment_id: z.string().uuid(),
  client_id: z.string().uuid(),
  language: z.enum(["en", "he"]),
  responses: z.array(AssessmentResponseSchema),
});

export type QuestionnaireTemplateInput = z.infer<typeof QuestionnaireTemplateSchema>;
export type AssessmentSubmissionInput = z.infer<typeof AssessmentSubmissionSchema>;
