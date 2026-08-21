"use server";

/**
 * lib/actions/inbox.ts
 *
 * Unified Inbox: merges WhatsApp and Facebook Messenger conversations
 * for the current org into a single, latest-message-first thread list.
 */

import { requireOrgContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ok, toActionError, type ActionResult } from "@/lib/actions/action-result";

export interface InboxThread {
  contactId: string;
  contactName: string;
  channel: "whatsapp" | "facebook";
  channelId: string;
  lastMessageText: string;
  lastMessageAt: string;
  lastDirection: "inbound" | "outbound";
}

function last10Digits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export async function getInboxThreads(): Promise<ActionResult<InboxThread[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, phone, facebook_psid")
      .eq("org_id", ctx.orgId)
      .is("deleted_at", null)
      .or("phone.not.is.null,facebook_psid.not.is.null");

    if (contactsError) throw contactsError;
    if (!contacts || contacts.length === 0) return ok([]);

    const threads: InboxThread[] = [];

    const whatsappContacts = contacts.filter((c) => c.phone);
    const facebookContacts = contacts.filter((c) => c.facebook_psid);

    if (whatsappContacts.length > 0) {
      const { data: waMessages } = await supabase
        .from("whatsapp_messages")
        .select("phone, message_text, direction, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      for (const contact of whatsappContacts) {
        const digits = last10Digits(contact.phone!);
        const latest = waMessages?.find(
          (m) => last10Digits(m.phone) === digits
        );
        if (latest) {
          threads.push({
            contactId: contact.id,
            contactName: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown",
            channel: "whatsapp",
            channelId: contact.phone!,
            lastMessageText: latest.message_text,
            lastMessageAt: latest.created_at,
            lastDirection: latest.direction,
          });
        }
      }
    }

    if (facebookContacts.length > 0) {
      const { data: fbMessages } = await supabase
        .from("facebook_messages")
        .select("psid, message_text, direction, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      for (const contact of facebookContacts) {
        const latest = fbMessages?.find((m) => m.psid === contact.facebook_psid);
        if (latest) {
          threads.push({
            contactId: contact.id,
            contactName: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown",
            channel: "facebook",
            channelId: contact.facebook_psid!,
            lastMessageText: latest.message_text,
            lastMessageAt: latest.created_at,
            lastDirection: latest.direction,
          });
        }
      }
    }

    threads.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return ok(threads);
  } catch (err) {
    return toActionError(err);
  }
}
