"use server";

/**
 * lib/actions/contacts.ts
 *
 * Server Actions for the Contacts entity. Every mutation:
 *   1. Resolves the caller's org context (auth + active org + role)
 *   2. Validates input with the matching Zod schema
 *   3. Executes the query through the RLS-bound Supabase server client
 *      (never the service role client) — RLS is the real authorization
 *      boundary; the role check here is only for a fast, friendly error
 *      instead of a raw Postgres 42501.
 *   4. Revalidates the affected paths
 *   5. Returns an ActionResult<T> — never throws to the caller
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import {
  contactSchema,
  contactUpdateSchema,
  contactFiltersSchema,
  type ContactFormInput,
  type ContactUpdateInput,
  type ContactFiltersInput,
} from "@/lib/validations/contact";
import { canEditRecord, canDeleteRecords } from "@/types/crm";
import type { ContactWithRelations, PaginatedResult } from "@/types/crm";

const CONTACT_SELECT = `
  *,
  company:companies ( id, name, domain ),
  owner:profiles!contacts_owner_id_fkey ( id, full_name, email, avatar_url )
`;

export async function listContacts(
  rawFilters: Partial<ContactFiltersInput>
): Promise<ActionResult<PaginatedResult<ContactWithRelations>>> {
  try {
    const ctx = await requireOrgContext();
    const filters = contactFiltersSchema.parse(rawFilters);
    const supabase = await createClient();

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;

    let query = supabase
      .from("contacts")
      .select(CONTACT_SELECT, { count: "exact" })
      .eq("org_id", ctx.orgId)
      .is("deleted_at", null);

    if (filters.search) {
      const term = filters.search.replace(/[%_]/g, "\\$&");
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`
      );
    }
    if (filters.companyId) query = query.eq("company_id", filters.companyId);
    if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
    if (filters.lifecycleStage?.length) query = query.in("lifecycle_stage", filters.lifecycleStage);
    if (filters.leadStatus?.length) query = query.in("lead_status", filters.leadStatus);
    if (filters.createdAfter) query = query.gte("created_at", filters.createdAfter);
    if (filters.createdBefore) query = query.lte("created_at", filters.createdBefore);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const totalCount = count ?? 0;

    return ok({
      data: (data ?? []) as unknown as ContactWithRelations[],
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / filters.pageSize)),
    });
  } catch (err) {
    return toActionError(err);
  }
}

export async function getContact(id: string): Promise<ActionResult<ContactWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("org_id", ctx.orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) throw error;
    if (!data) return fail("Contact not found.");

    return ok(data as unknown as ContactWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

export async function createContact(
  input: ContactFormInput
): Promise<ActionResult<ContactWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const parsed = contactSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        org_id: ctx.orgId,
        created_by: ctx.userId,
        owner_id: parsed.owner_id ?? ctx.userId,
        first_name: parsed.first_name,
        last_name: parsed.last_name ?? null,
        email: parsed.email ?? null,
        phone: parsed.phone ?? null,
        job_title: parsed.job_title ?? null,
        company_id: parsed.company_id ?? null,
        lifecycle_stage: parsed.lifecycle_stage,
        lead_status: parsed.lead_status,
        source: parsed.source ?? null,
        linkedin_url: parsed.linkedin_url ?? null,
      })
      .select(CONTACT_SELECT)
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/contacts");
    return ok(data as unknown as ContactWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateContact(
  input: ContactUpdateInput
): Promise<ActionResult<ContactWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const parsed = contactUpdateSchema.parse(input);
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("contacts")
      .select("id, owner_id, created_by")
      .eq("org_id", ctx.orgId)
      .eq("id", parsed.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) return fail("Contact not found.");

    if (!canEditRecord(ctx.role, ctx.userId, existing)) {
      return fail("You don't have permission to edit this contact.");
    }

    const { id, ...updates } = parsed;

    const { data, error } = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select(CONTACT_SELECT)
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/contacts");
    revalidatePath(`/dashboard/contacts/${id}`);
    return ok(data as unknown as ContactWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteContact(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrgContext();

    if (!canDeleteRecords(ctx.role)) {
      return fail("Only admins and sales managers can delete contacts.");
    }

    const supabase = await createClient();

    // Soft delete — preserves the audit trail and any activities/deals
    // still referencing this contact.
    const { error } = await supabase
      .from("contacts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgId);

    if (error) throw error;

    revalidatePath("/dashboard/contacts");
    return ok({ id });
  } catch (err) {
    return toActionError(err);
  }
}

/** Bulk-assign an owner — used by the contacts table's multi-select toolbar. */
export async function reassignContacts(
  contactIds: string[],
  ownerId: string
): Promise<ActionResult<{ updated: number }>> {
  try {
    const ctx = await requireOrgContext();

    if (!contactIds.length) return fail("No contacts selected.");

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("contacts")
      .update({ owner_id: ownerId })
      .eq("org_id", ctx.orgId)
      .in("id", contactIds)
      .select("id");

    if (error) throw error;

    revalidatePath("/dashboard/contacts");
    return ok({ updated: data?.length ?? 0 });
  } catch (err) {
    return toActionError(err);
  }
}
