"use client";

/**
 * components/contacts/contacts-table.tsx
 *
 * Owns filter/pagination state in the URL-independent React state (kept
 * simple — not synced to the URL query string here; that's a
 * straightforward follow-up via useSearchParams/router.replace if deep
 *-linkable filtered views are needed later) and re-fetches through the
 * listContacts Server Action on every change.
 */

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Pencil, AlertCircle } from "lucide-react";
import { listContacts, deleteContact } from "@/lib/actions/contacts";
import { SearchInput } from "@/components/shared/search-input";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { cn, formatDate, initials } from "@/lib/utils";
import type {
  ContactWithRelations,
  PaginatedResult,
  LifecycleStage,
  LeadStatus,
} from "@/types/crm";

const LIFECYCLE_OPTIONS: { value: LifecycleStage; label: string }[] = [
  { value: "subscriber", label: "Subscriber" },
  { value: "lead", label: "Lead" },
  { value: "marketing_qualified_lead", label: "MQL" },
  { value: "sales_qualified_lead", label: "SQL" },
  { value: "opportunity", label: "Opportunity" },
  { value: "customer", label: "Customer" },
  { value: "evangelist", label: "Evangelist" },
  { value: "other", label: "Other" },
];

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "connected", label: "Connected" },
  { value: "attempted_to_contact", label: "Attempted to contact" },
  { value: "unqualified", label: "Unqualified" },
  { value: "bad_timing", label: "Bad timing" },
];

const PAGE_SIZE = 25;

interface ContactsTableProps {
  initialData: PaginatedResult<ContactWithRelations>;
  canDelete: boolean;
}

export function ContactsTable({ initialData, canDelete }: ContactsTableProps) {
  const [result, setResult] = useState(initialData);
  const [search, setSearch] = useState("");
  const [lifecycleStage, setLifecycleStage] = useState<LifecycleStage | "">("");
  const [leadStatus, setLeadStatus] = useState<LeadStatus | "">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await listContacts({
        search: search || undefined,
        lifecycleStage: lifecycleStage ? [lifecycleStage] : undefined,
        leadStatus: leadStatus ? [leadStatus] : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (res.success) {
        setResult(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, lifecycleStage, leadStatus, page]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this contact? This can be undone by an admin via the audit log.")) return;
    setPendingDeleteId(id);
    const res = await deleteContact(id);
    setPendingDeleteId(null);
    if (res.success) {
      setResult((prev) => ({
        ...prev,
        data: prev.data.filter((c) => c.id !== id),
        totalCount: prev.totalCount - 1,
      }));
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Search name or email…"
            onSearch={(v) => {
              setPage(1);
              setSearch(v);
            }}
          />
          <select
            value={lifecycleStage}
            onChange={(e) => {
              setPage(1);
              setLifecycleStage(e.target.value as LifecycleStage | "");
            }}
            className="rounded-md border border-zinc-200 bg-white py-1.5 px-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none"
          >
            <option value="">All lifecycle stages</option>
            {LIFECYCLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={leadStatus}
            onChange={(e) => {
              setPage(1);
              setLeadStatus(e.target.value as LeadStatus | "");
            }}
            className="rounded-md border border-zinc-200 bg-white py-1.5 px-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none"
          >
            <option value="">All lead statuses</option>
            {LEAD_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <Link
          href="/contacts/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus className="size-4" />
          New contact
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className={cn("overflow-x-auto rounded-lg border border-zinc-200 bg-white", isPending && "opacity-60")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs text-zinc-500">
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Lifecycle stage</th>
              <th className="px-3 py-2.5 font-medium">Lead status</th>
              <th className="px-3 py-2.5 font-medium">Owner</th>
              <th className="px-3 py-2.5 font-medium">Created</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((contact) => (
              <tr key={contact.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {contact.first_name} {contact.last_name ?? ""}
                  </Link>
                  {contact.email && <p className="text-xs text-zinc-400">{contact.email}</p>}
                </td>
                <td className="px-3 py-2.5 text-zinc-600">{contact.company?.name ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {LIFECYCLE_OPTIONS.find((o) => o.value === contact.lifecycle_stage)?.label}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-zinc-600">
                  {LEAD_STATUS_OPTIONS.find((o) => o.value === contact.lead_status)?.label}
                </td>
                <td className="px-3 py-2.5">
                  {contact.owner && (
                    <span
                      title={contact.owner.full_name ?? contact.owner.email}
                      className="flex size-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-white"
                    >
                      {initials(contact.owner.full_name ?? contact.owner.email)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-500">{formatDate(contact.created_at)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/contacts/${contact.id}/edit`}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label="Edit contact"
                    >
                      <Pencil className="size-3.5" />
                    </Link>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(contact.id)}
                        disabled={pendingDeleteId === contact.id}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label="Delete contact"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {result.data.length === 0 && !isPending && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-zinc-400">
                  No contacts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <DataTablePagination
          page={result.page}
          totalPages={result.totalPages}
          totalCount={result.totalCount}
          pageSize={result.pageSize}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
