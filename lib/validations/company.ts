import { z } from "zod";

export const companySizeValues = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5000+",
] as const;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(255),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a valid domain, e.g. acme.com")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  industry: optionalTrimmedString(120),
  phone: optionalTrimmedString(50),
  website: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  size: z.enum(companySizeValues).optional(),
  annual_revenue: z.coerce.number().min(0).max(999_999_999_999).optional(),
  address_line1: optionalTrimmedString(255),
  address_line2: optionalTrimmedString(255),
  city: optionalTrimmedString(120),
  state: optionalTrimmedString(120),
  postal_code: optionalTrimmedString(30),
  country: optionalTrimmedString(120),
  description: optionalTrimmedString(2000),
  owner_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
});

export type CompanyFormInput = z.infer<typeof companySchema>;

export const companyUpdateSchema = companySchema.partial().extend({
  id: z.string().uuid(),
});

export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;

export const companyFiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  ownerId: z.string().uuid().optional(),
  industry: z.string().trim().max(120).optional(),
  size: z.array(z.enum(companySizeValues)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CompanyFiltersInput = z.infer<typeof companyFiltersSchema>;
