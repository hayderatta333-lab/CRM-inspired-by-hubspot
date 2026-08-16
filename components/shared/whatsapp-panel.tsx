"use client";

/**
 * components/shared/whatsapp-panel.tsx
 *
 * WhatsApp conversation panel for the Contact detail page. Renders the
 * message thread as chat bubbles and a send box. Calls the Server
 * Actions in lib/actions/whatsapp.ts — never talks to the WhatsApp API
 * or Supabase directly from the client.
 */

import { useState, useRef, useEffect, useTransition } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { getWhatsAppThread, sendWhatsAppToContact, type WhatsAppMessage } from "@/lib/actions/whatsapp";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WhatsAppPanel({
  phone,
  initialMessages,
}: {
  phone: string | null;
  initialMessages: WhatsAppMessage[];
}) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!phone) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <MessageCircle className="size-4 text-zinc-400" />
          WhatsApp
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Add a phone number to this contact to enable WhatsApp messaging.
        </p>
      </div>
    );
  }

  function handleSend() {
    const text = draft.trim();
    if (!text || !phone) return;
    setError(null);

    const optimistic: WhatsAppMessage = {
      id: `optimistic-${Date.now()}`,
      phone,
      contact_name: null,
      message_text: text,
      direction: "outbound",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    startTransition(async () => {
      const result = await sendWhatsAppToContact(phone, text);
      if (!result.success) {
        setError(result.error);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        return;
      }
      const refreshed = await getWhatsAppThread(phone);
      if (refreshed.success) setMessages(refreshed.data);
    });
  }

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
        <MessageCircle className="size-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-zinc-900">WhatsApp</h2>
        <span className="ml-auto text-xs text-zinc-400">{phone}</span>
      </div>

      <div className="flex max-h-96 min-h-40 flex-col gap-2 overflow-y-auto bg-zinc-50 px-4 py-3">
        {messages.length === 0 && (
          <p className="m-auto text-xs text-zinc-400">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                m.direction === "outbound"
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-200 bg-white text-zinc-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.message_text}</p>
              <p
                className={`mt-1 text-right text-[10px] ${
                  m.direction === "outbound" ? "text-emerald-100" : "text-zinc-400"
                }`}
              >
                {formatTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-zinc-100 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          disabled={isPending}
          className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        <button
          onClick={handleSend}
          disabled={isPending || !draft.trim()}
          className="flex size-9 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
          aria-label="Send message"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  );
}
