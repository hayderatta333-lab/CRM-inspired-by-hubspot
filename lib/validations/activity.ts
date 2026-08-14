import { z } from "zod";

export const activityTypeValues = ["note", "call", "email", "meeting", "task"] as const;
export const activityStatusValues = ["planned", "completed", "canceled"] as const;
export const callOutcomeValues = [
  "connected",
  "left_voicemail",
  "no_answer",
  "busy",
  "wrong_number",
] as const;
export const taskPriorityValues = ["low", "medium", "high"] as const;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const activitySchema = z
  .object({
    type: z.enum(activityTypeValues),
    subject: z.string().trim().min(1, "Subject is required.").max(255),
    body: optionalTrimmedString(10_000),
    status: z.enum(activityStatusValues).default("planned"),

    // polymorphic parent — at least one required, enforced below
    contact_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    company_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    deal_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),

    // task-specific
    due_at: z.string().datetime().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    priority: z.enum(taskPriorityValues).default("medium"),

    // call-specific
    call_outcome: z.enum(callOutcomeValues).optional(),
    duration_seconds: z.coerce.number().int().min(0).optional(),

    // meeting-specific
    starts_at: z.string().datetime().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    ends_at: z.string().datetime().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    location: optionalTrimmedString(255),

    owner_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
  })
  .refine((d) => d.contact_id || d.company_id || d.deal_id, {
    message: "An activity must be linked to a contact, company, or deal.",
    path: ["contact_id"],
  })
  .refine((d) => !d.starts_at || !d.ends_at || d.ends_at >= d.starts_at, {
    message: "End time must be after start time.",
    path: ["ends_at"],
  })
  .refine((d) => d.type !== "task" || d.due_at !== undefined, {
    message: "Tasks require a due date.",
    path: ["due_at"],
  })
  .refine((d) => d.type !== "meeting" || d.starts_at !== undefined, {
    message: "Meetings require a start time.",
    path: ["starts_at"],
  });

export type ActivityFormInput = z.infer<typeof activitySchema>;

export const activityUpdateSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().trim().min(1).max(255).optional(),
  body: z.string().trim().max(10_000).nullable().optional(),
  status: z.enum(activityStatusValues).optional(),
  due_at: z.string().datetime().nullable().optional(),
  priority: z.enum(taskPriorityValues).optional(),
  call_outcome: z.enum(callOutcomeValues).nullable().optional(),
  duration_seconds: z.coerce.number().int().min(0).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
});

export type ActivityUpdateInput = z.infer<typeof activityUpdateSchema>;

/** Marks a task/activity complete — the common one-click action from the timeline UI. */
export const activityCompleteSchema = z.object({
  id: z.string().uuid(),
});
