"use server";

/**
 * lib/actions/companies.ts
 *
 * Mirrors the structure of lib/actions/contacts.ts — see the header
 * comment there for the shared conventions (ActionResult, RLS-bound
 * client, revalidation). Additionally computes per-company rollups
 * (contact count, open deal count/value) needed for the 360 view and
 * the companies list, via two lightweight count/aggregate queries
 * rather than a heavier join, since Supabase's PostgREST embedding
 * doesn't aggregate across the deals table cleanly.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import {
  companySchema,
  companyUpdateSchema,
  companyFiltersSchema,
  type CompanyFormInput,
  type CompanyUpdateInput,
  type CompanyFiltersInput,
} from "@/lib/validations/company";
import { canEditRecord, canDeleteRecords } from "@/types/crm";
import type { CompanyWithOwner, PaginatedResult } from "@/types/crm";

const COMPANY_SELECT = `
  *,
  owner:profiles!companies_owner_id_fkey ( id, full_name, email, avatar_url )
`;

export async function listCompanies(
  rawFilters: Partial<CompanyFiltersInput>
): Promise<ActionResult<PaginatedResult<CompanyWithOwner>>> {
  try {
    const ctx = await requireOrgContext();
    const filters = companyFiltersSchema.parse(rawFilters);
    const supabase = await createClient();

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;

    let query = supabase
      .from("companies")
      .select(COMPANY_SELECT, { count: "exact" })
      .eq("org_id", ctx.orgId)
      .is("deleted_at", null);

    if (filters.search) {
      const term = filters.search.replace(/[%_]/g, "\\$&");
      query = query.or(`name.ilike.%${term}%,domain.ilike.%${term}%`);
    }
    if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
    if (filters.industry) query = query.eq("industry", filters.industry);
    if (filters.size?.length) query = query.in("size", filters.size);

    const { data: companies, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const companyIds = (companies ?? []).map((c) => c.id);
    const rollups = await getCompanyRollups(companyIds, ctx.orgId);

    const enriched: CompanyWithOwner[] = (companies ?? []).map((c) => ({
      ...(c as unknown as CompanyWithOwner),
      contact_count: rollups.get(c.id)?.contact_count ?? 0,
      open_deal_count: rollups.get(c.id)?.open_deal_count ?? 0,
      open_deal_value: rollups.get(c.id)?.open_deal_value ?? 0,
    }));

    const totalCount = count ?? 0;

    return ok({
      data: enriched,
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / filters.pageSize)),
    });
  } catch (err) {
    return toActionError(err);
  }
}

export async function getCompany(id: string): Promise<ActionResult<CompanyWithOwner>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("org_id", ctx.orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) throw error;
    if (!data) return fail("Company not found.");

    const rollups = await getCompanyRollups([id], ctx.orgId);
    const rollup = rollups.get(id);

    return ok({
      ...(data as unknown as CompanyWithOwner),
      contact_count: rollup?.contact_count ?? 0,
      open_deal_count: rollup?.open_deal_count ?? 0,
      open_deal_value: rollup?.open_deal_value ?? 0,
    });
  } catch (err) {
    return toActionError(err);
  }
}

export async function createCompany(
  input: CompanyFormInput
): Promise<ActionResult<CompanyWithOwner>> {
  try {
    const ctx = await requireOrgContext();
    const parsed = companySchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("companies")
      .insert({
        org_id: ctx.orgId,
        created_by: ctx.userId,
        owner_id: parsed.owner_id ?? ctx.userId,
        name: parsed.name,
        domain: parsed.domain ?? null,
        industry: parsed.industry ?? null,
        phone: parsed.phone ?? null,
        website: parsed.website ?? null,
        size: parsed.size ?? null,
        annual_revenue: parsed.annual_revenue ?? null,
        address_line1: parsed.address_line1 ?? null,
        address_line2: parsed.address_line2 ?? null,
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        postal_code: parsed.postal_code ?? null,
        country: parsed.country ?? null,
        description: parsed.description ?? null,
      })
      .select(COMPANY_SELECT)
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/companies");
    return ok({
      ...(data as unknown as CompanyWithOwner),
      contact_count: 0,
      open_deal_count: 0,
      open_deal_value: 0,
    });
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCompany(
  input: CompanyUpdateInput
): Promise<ActionResult<CompanyWithOwner>> {
  try {
    const ctx = await requireOrgContext();
    const parsed = companyUpdateSchema.parse(input);
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("companies")
      .select("id, owner_id, created_by")
      .eq("org_id", ctx.orgId)
      .eq("id", parsed.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) return fail("Company not found.");

    if (!canEditRecord(ctx.role, ctx.userId, existing)) {
      return fail("You don't have permission to edit this company.");
    }

    const { id, ...updates } = parsed;

    const { data, error } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select(COMPANY_SELECT)
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/companies");
    revalidatePath(`/dashboard/companies/${id}`);

    const rollups = await getCompanyRollups([id], ctx.orgId);
    const rollup = rollups.get(id);

    return ok({
      ...(data as unknown as CompanyWithOwner),
      contact_count: rollup?.contact_count ?? 0,
      open_deal_count: rollup?.open_deal_count ?? 0,
      open_deal_value: rollup?.open_deal_value ?? 0,
    });
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteCompany(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrgContext();

    if (!canDeleteRecords(ctx.role)) {
      return fail("Only admins and sales managers can delete companies.");
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgId);

    if (error) throw error;

    revalidatePath("/dashboard/companies");
    return ok({ id });
  } catch (err) {
    return toActionError(err);
  }
}

/** Lightweight {id, name} list for populating "Company" selects on other forms. */
export async function listCompanyOptions(): Promise<ActionResult<Pick<Company, "id" | "name">[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .eq("org_id", ctx.orgId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(500);

    if (error) throw error;

    return ok(data ?? []);
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Batches contact-count and open-deal rollups for a set of company IDs
 * into two queries total (regardless of how many companies), instead of
 * N+1 queries per row.
 */
async function getCompanyRollups(
  companyIds: string[],
  orgId: string
): Promise<Map<string, { contact_count: number; open_deal_count: number; open_deal_value: number }>> {
  const result = new Map<
    string,
    { contact_count: number; open_deal_count: number; open_deal_value: number }
  >();

  if (companyIds.length === 0) return result;

  const supabase = await createClient();

  const [{ data: contactRows, error: contactError }, { data: dealRows, error: dealError }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("company_id")
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .in("company_id", companyIds),
      supabase
        .from("deals")
        .select("company_id, amount")
        .eq("org_id", orgId)
        .eq("status", "open")
        .is("deleted_at", null)
        .in("company_id", companyIds),
    ]);

  if (contactError) throw contactError;
  if (dealError) throw dealError;

  for (const id of companyIds) {
    result.set(id, { contact_count: 0, open_deal_count: 0, open_deal_value: 0 });
  }

  for (const row of contactRows ?? []) {
    if (!row.company_id) continue;
    const entry = result.get(row.company_id);
    if (entry) entry.contact_count += 1;
  }

  for (const row of dealRows ?? []) {
    if (!row.company_id) continue;
    const entry = result.get(row.company_id);
    if (entry) {
      entry.open_deal_count += 1;
      entry.open_deal_value += Number(row.amount);
    }
  }

  return result;
}
