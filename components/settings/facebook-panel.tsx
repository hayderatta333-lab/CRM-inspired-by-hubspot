"use client";

import { useState } from "react";
import {
  connectFacebookPage,
  disconnectFacebookPage,
  type FacebookConnectionSummary,
} from "@/lib/actions/facebook";

export function FacebookPanel({ initialConnections }: { initialConnections: FacebookConnectionSummary[] }) {
  const [connections, setConnections] = useState<FacebookConnectionSummary[]>(initialConnections);
  const [showForm, setShowForm] = useState(false);
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [pageToken, setPageToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!pageId.trim() || !pageToken.trim()) {
      setError("Page ID aur Page Access Token dono zaroori hain.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await connectFacebookPage({
      pageId: pageId.trim(),
      pageName: pageName.trim() || undefined,
      pageAccessToken: pageToken.trim(),
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setConnections((prev) => [
      {
        id: result.data.id,
        page_id: pageId.trim(),
        page_name: pageName.trim() || null,
        created_at: new Date().toISOString(),
        revoked_at: null,
      },
      ...prev,
    ]);
    setPageId("");
    setPageName("");
    setPageToken("");
    setShowForm(false);
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Is Facebook Page ko disconnect karein? Messenger auto-reply aur Lead Ads sync ruk jayega.")) return;
    const result = await disconnectFacebookPage(id);
    if (result.success) {
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, revoked_at: new Date().toISOString() } : c))
      );
    }
  }

  return (
    <div className="max-w-2xl mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Facebook Pages</h2>
          <p className="text-xs text-zinc-500">
            Messenger auto-reply aur Lead Ads leads is CRM mein automatically aayenge.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 shrink-0"
          >
            + Connect Page
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-zinc-200 p-3 space-y-2">
          <input
            type="text"
            placeholder="Page ID"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            className="w-full text-sm border border-zinc-200 rounded px-2 py-1.5"
          />
          <input
            type="text"
            placeholder="Page Name (optional)"
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            className="w-full text-sm border border-zinc-200 rounded px-2 py-1.5"
          />
          <input
            type="text"
            placeholder="Page Access Token"
            value={pageToken}
            onChange={(e) => setPageToken(e.target.value)}
            className="w-full text-sm border border-zinc-200 rounded px-2 py-1.5"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Connecting..." : "Connect"}
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
        {connections.length === 0 && (
          <p className="text-sm text-zinc-400 p-4">Koi Facebook Page connected nahi hai.</p>
        )}
        {connections.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">{c.page_name || c.page_id}</p>
              <p className="text-xs text-zinc-500">
                Page ID: {c.page_id}
                {c.revoked_at && <span className="text-red-500"> · disconnected</span>}
              </p>
            </div>
            {!c.revoked_at && (
              <button
                onClick={() => handleDisconnect(c.id)}
                className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
              >
                Disconnect
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
