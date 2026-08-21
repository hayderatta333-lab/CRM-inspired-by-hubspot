"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { MessageCircle, Facebook, Send, Loader2, Inbox as InboxIcon } from "lucide-react";
import { getWhatsAppThread, sendWhatsAppToContact, type WhatsAppMessage } from "@/lib/actions/whatsapp";
import { getFacebookThread, sendFacebookToContact, type FacebookMessage } from "@/lib/actions/facebook";
import { type InboxThread } from "@/lib/actions/inbox";
import { createClient } from "@/lib/supabase/client";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function last10Digits(phone: string) {
  return phone.replace(/\D/g, "").slice(-10);
}

interface UnifiedMessage {
  id: string;
  text: string;
  direction: "inbound" | "outbound";
  created_at: string;
}

function toUnified(messages: (WhatsAppMessage | FacebookMessage)[]): UnifiedMessage[] {
  return messages.map((m: any) => ({
    id: m.id,
    text: m.message_text,
    direction: m.direction,
    created_at: m.created_at,
  }));
}

export function InboxPanel({ initialThreads }: { initialThreads: InboxThread[] }) {
  const [threads] = useState<InboxThread[]>(initialThreads);
  const [selected, setSelected] = useState<InboxThread | null>(initialThreads[0] ?? null);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [rtStatus, setRtStatus] = useState<string>("connecting...");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    async function load() {
      if (selected!.channel === "whatsapp") {
        const result = await getWhatsAppThread(selected!.channelId);
        if (!cancelled && result.success) setMessages(toUnified(result.data));
      } else {
        const result = await getFacebookThread(selected!.channelId);
        if (!cancelled && result.success) setMessages(toUnified(result.data));
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [selected?.channelId, selected?.channel]);

  useEffect(() => {
    if (!selected) return;
    const channelType = selected.channel;
    const channelId = selected.channelId;
    const table = channelType === "whatsapp" ? "whatsapp_messages" : "facebook_messages";
    const digits = channelType === "whatsapp" ? last10Digits(channelId) : channelId;

    const supabase = createClient();
    let cancelled = false;
    let currentChannel: any = null;

    function connect() {
      const ch = supabase
        .channel(`inbox-thread-${channelType}-${digits}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table },
          (payload) => {
            const row = payload.new as any;
            const rowKey = channelType === "whatsapp" ? last10Digits(row.phone) : row.psid;
            if (rowKey !== digits) return;
            const unified: UnifiedMessage = {
              id: row.id,
              text: row.message_text,
              direction: row.direction,
              created_at: row.created_at,
            };
            setMessages((prev) => {
              if (prev.some((m) => m.id === unified.id)) return prev;
              return [...prev, unified];
            });
          }
        )
        .subscribe((status) => {
          setRtStatus(status);
          if (!cancelled && (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")) {
            supabase.removeChannel(ch);
            setTimeout(connect, 300);
          }
        });
      currentChannel = ch;
    }

    connect();

    return () => {
      cancelled = true;
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [selected?.channelId, selected?.channel]);

  function handleSend() {
    if (!selected) return;
    const text = draft.trim();
    if (!text) return;
    setError(null);

    const optimistic: UnifiedMessage = {
      id: `optimistic-${Date.now()}`,
      text,
      direction: "outbound",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    startTransition(async () => {
      const result =
        selected.channel === "whatsapp"
          ? await sendWhatsAppToContact(selected.channelId, text)
          : await sendFacebookToContact(selected.channelId, text);

      if (!result.success) {
        setError(result.error);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        return;
      }

      if (selected.channel === "whatsapp") {
        const refreshed = await getWhatsAppThread(selected.channelId);
        if (refreshed.success) setMessages(toUnified(refreshed.data));
      } else {
        const refreshed = await getFacebookThread(selected.channelId);
        if (refreshed.success) setMessages(toUnified(refreshed.data));
      }
    });
  }

  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-200">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <InboxIcon className="size-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Inbox</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 && (
            <p className="p-4 text-xs text-zinc-400">No conversations yet.</p>
          )}
          {threads.map((t) => (
            <button
              key={`${t.channel}-${t.channelId}`}
              onClick={() => setSelected(t)}
              className={`flex w-full flex-col gap-0.5 border-b border-zinc-100 px-4 py-3 text-left hover:bg-zinc-50 ${
                selected?.channelId === t.channelId && selected?.channel === t.channel ? "bg-zinc-50" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {t.channel === "whatsapp" ? (
                  <MessageCircle className="size-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <Facebook className="size-3.5 shrink-0 text-blue-600" />
                )}
                <span className="truncate text-sm font-medium text-zinc-900">{t.contactName}</span>
              </div>
              <p className="truncate text-xs text-zinc-400">{t.lastMessageText}</p>
              <span className="text-[10px] text-zinc-400">{formatTime(t.lastMessageAt)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
              {selected.channel === "whatsapp" ? (
                <MessageCircle className="size-4 text-emerald-600" />
              ) : (
                <Facebook className="size-4 text-blue-600" />
              )}
              <h2 className="text-sm font-semibold text-zinc-900">{selected.contactName}</h2>
              <span className="ml-auto text-xs text-zinc-400">RT: {rtStatus}</span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-zinc-50 px-4 py-3">
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
                        ? selected.channel === "whatsapp"
                          ? "bg-emerald-600 text-white"
                          : "bg-blue-600 text-white"
                        : "border border-zinc-200 bg-white text-zinc-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        m.direction === "outbound" ? "text-white/80" : "text-zinc-400"
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
          </>
        )}
      </div>
    </div>
  );
}
