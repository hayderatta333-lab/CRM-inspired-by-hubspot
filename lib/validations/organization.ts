import { z } from "zod";

export const orgRoleValues = ["admin", "sales_manager", "sales_rep"] as const;

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Organization name must be at least 2 characters.").max(255),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(63)
    .regex(slugRegex, "Use lowercase letters, numbers, and hyphens only."),
});

export type OrganizationFormInput = z.infer<typeof organizationSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(orgRoleValues).default("sales_rep"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().uuid(),
  role: z.enum(orgRoleValues),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
