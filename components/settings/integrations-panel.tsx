"use client";

import { useState } from "react";
import { generateApiKey, revokeApiKey, type ApiKeySummary } from "@/lib/actions/integrations";

const WEBHOOK_URL = "https://crm-inspired-by-hubspot.vercel.app/api/n8n/webhook";

export function IntegrationsPanel({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const [keys, setKeys] = useState<ApiKeySummary[]>(initialKeys);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCopy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleGenerate() {
    if (!name.trim()) {
      setError("Please enter a name for this key.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await generateApiKey({ name: name.trim(), service: "n8n" });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNewRawKey(result.data.rawKey);
    setName("");
    setShowForm(false);
    setKeys((prev) => [
      {
        id: result.data.id,
        name: name.trim(),
        service: "n8n",
        key_prefix: result.data.rawKey.slice(0, 12),
        created_at: new Date().toISOString(),
        last_used_at: null,
        revoked_at: null,
      },
      ...prev,
    ]);
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Revoke this key? Any integration using it will stop working immediately.")) return;
    const result = await revokeApiKey(keyId);
    if (result.success) {
      setKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k))
      );
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Webhook URL</h2>
        <p className="text-xs text-zinc-500 mb-2">
          Use this URL as the endpoint in your n8n HTTP Request node, with your API key as the{" "}
          <code className="bg-zinc-200 px-1 rounded">x-n8n-secret</code> header.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-white border border-zinc-200 rounded px-2 py-1.5 overflow-x-auto">
            {WEBHOOK_URL}
          </code>
          <button
            onClick={() => handleCopy(WEBHOOK_URL, "url")}
            className="text-xs px-2 py-1.5 rounded bg-zinc-900 text-white hover:bg-zinc-700 shrink-0"
          >
            {copied === "url" ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {newRawKey && (
        <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <h2 className="text-sm font-semibold text-emerald-900 mb-1">
            Your new API key (copy it now — it won't be shown again)
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-xs bg-white border border-emerald-200 rounded px-2 py-1.5 overflow-x-auto">
              {newRawKey}
            </code>
            <button
              onClick={() => handleCopy(newRawKey, "key")}
              className="text-xs px-2 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
            >
              {copied === "key" ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setNewRawKey(null)}
            className="mt-3 text-xs text-emerald-700 hover:underline"
          >
            I've saved it, hide this
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900">API Keys</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-3 py-1.5 rounded bg-zinc-900 text-white hover:bg-zinc-700"
          >
            + Generate New Key
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-zinc-200 p-3">
          <input
            type="text"
            placeholder="Key name (e.g. n8n Production)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border border-zinc-200 rounded px-2 py-1.5 mb-2"
          />
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {pending ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="text-xs px-3 py-1.5 rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg">
        {keys.length === 0 && (
          <p className="text-sm text-zinc-400 p-4">No API keys yet.</p>
        )}
        {keys.map((key) => (
          <div key={key.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">{key.name}</p>
              <p className="text-xs text-zinc-500">
                {key.key_prefix}••••••••• · {key.service}
                {key.revoked_at && <span className="text-red-500"> · revoked</span>}
              </p>
            </div>
            {!key.revoked_at && (
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
