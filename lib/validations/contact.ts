import { z } from "zod";

export const lifecycleStageValues = [
  "subscriber",
  "lead",
  "marketing_qualified_lead",
  "sales_qualified_lead",
  "opportunity",
  "customer",
  "evangelist",
  "other",
] as const;

export const leadStatusValues = [
  "new",
  "open",
  "in_progress",
  "connected",
  "attempted_to_contact",
  "unqualified",
  "bad_timing",
] as const;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const contactSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required.").max(120),
  last_name: optionalTrimmedString(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(255)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  phone: optionalTrimmedString(50),
  job_title: optionalTrimmedString(150),
  company_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
  lifecycle_stage: z.enum(lifecycleStageValues).default("lead"),
  lead_status: z.enum(leadStatusValues).default("new"),
  source: optionalTrimmedString(120),
  linkedin_url: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  owner_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
});

export type ContactFormInput = z.infer<typeof contactSchema>;

export const contactUpdateSchema = contactSchema.partial().extend({
  id: z.string().uuid(),
});

export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

export const contactFiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  companyId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  lifecycleStage: z.array(z.enum(lifecycleStageValues)).optional(),
  leadStatus: z.array(z.enum(leadStatusValues)).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ContactFiltersInput = z.infer<typeof contactFiltersSchema>;
