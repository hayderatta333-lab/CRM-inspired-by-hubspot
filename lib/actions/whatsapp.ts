"use server";

/**
 * lib/actions/whatsapp.ts
 *
 * Server Actions for the WhatsApp conversation panel on the Contact
 * detail page. Reads use the RLS-bound client; the outbound insert uses
 * the admin client because whatsapp_messages/whatsapp_leads are keyed by
 * phone number, not org_id (see supabase/schema.sql for those tables).
 * requireOrgContext() below is still what gates access — only an
 * authenticated org member can reach this code at all.
 */

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth/session";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";

export interface WhatsAppMessage {
  id: string;
  phone: string;
  contact_name: string | null;
  message_text: string;
  direction: "inbound" | "outbound";
  created_at: string;
}

function last10Digits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/** Fetches the full message thread for a contact, matched by phone (last 10 digits). */
export async function getWhatsAppThread(
  contactPhone: string
): Promise<ActionResult<WhatsAppMessage[]>> {
  try {
    await requireOrgContext();

    if (!contactPhone) return ok([]);

    const digits = last10Digits(contactPhone);
    if (digits.length < 7) return ok([]);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("id, phone, contact_name, message_text, direction, created_at")
      .ilike("phone", `%${digits}`)
      .order("created_at", { ascending: false }).limit(100);

    if (error) throw error;
    return ok(((data ?? []) as WhatsAppMessage[]).reverse());
  } catch (err) {
    return toActionError(err);
  }
}

/** Sends an outbound WhatsApp message and logs it, from the Contact detail page. */
export async function sendWhatsAppToContact(
  phone: string,
  message: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireOrgContext();

    const trimmed = message.trim();
    if (!phone || !trimmed) {
      return fail("Phone number and message are required.");
    }

    const result = await sendWhatsAppMessage(phone, trimmed);

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .insert({
        phone,
        message_text: trimmed,
        direction: "outbound",
        raw_payload: result,
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase
      .from("whatsapp_leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("phone", phone);

    revalidatePath("/dashboard/contacts");
    return ok({ id: data.id });
  } catch (err) {
    return toActionError(err);
  }
}
