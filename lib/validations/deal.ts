import { z } from "zod";

export const dealStatusValues = ["open", "won", "lost"] as const;
export const billingFrequencyValues = ["one_time", "monthly", "quarterly", "yearly"] as const;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const dealSchema = z
  .object({
    name: z.string().trim().min(1, "Deal name is required.").max(255),
    pipeline_id: z.string().uuid("Select a pipeline."),
    stage_id: z.string().uuid("Select a stage."),
    company_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    primary_contact_id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),
    amount: z.coerce.number().min(0, "Amount must be zero or greater.").max(999_999_999_999),
    currency: z.string().length(3).default("USD"),
    is_recurring: z.boolean().default(false),
    recurring_amount: z.coerce.number().min(0).optional(),
    billing_frequency: z.enum(billingFrequencyValues).default("one_time"),
    expected_close_date: z.string().date().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    lost_reason: optionalTrimmedString(500),
    owner_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    contact_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => !data.is_recurring || data.recurring_amount !== undefined, {
    message: "Recurring amount is required for recurring deals.",
    path: ["recurring_amount"],
  });

export type DealFormInput = z.infer<typeof dealSchema>;

export const dealUpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(255).optional(),
    pipeline_id: z.string().uuid().optional(),
    stage_id: z.string().uuid().optional(),
    company_id: z.string().uuid().nullable().optional(),
    primary_contact_id: z.string().uuid().nullable().optional(),
    amount: z.coerce.number().min(0).max(999_999_999_999).optional(),
    currency: z.string().length(3).optional(),
    is_recurring: z.boolean().optional(),
    recurring_amount: z.coerce.number().min(0).nullable().optional(),
    billing_frequency: z.enum(billingFrequencyValues).optional(),
    expected_close_date: z.string().date().nullable().optional(),
    lost_reason: z.string().trim().max(500).nullable().optional(),
    owner_id: z.string().uuid().nullable().optional(),
  });

export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;

/** Dedicated, minimal schema for the drag-and-drop Kanban "move stage" action. */
export const dealStageMoveSchema = z.object({
  dealId: z.string().uuid(),
  stageId: z.string().uuid(),
});

export type DealStageMoveInput = z.infer<typeof dealStageMoveSchema>;

export const dealFiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.array(z.string().uuid()).optional(),
  ownerId: z.string().uuid().optional(),
  status: z.array(z.enum(dealStatusValues)).optional(),
  companyId: z.string().uuid().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  expectedCloseAfter: z.string().date().optional(),
  expectedCloseBefore: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type DealFiltersInput = z.infer<typeof dealFiltersSchema>;
