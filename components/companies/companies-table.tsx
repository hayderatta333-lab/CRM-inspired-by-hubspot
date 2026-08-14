"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Pencil, AlertCircle } from "lucide-react";
import { listCompanies, deleteCompany } from "@/lib/actions/companies";
import { SearchInput } from "@/components/shared/search-input";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { cn, formatCurrency, formatDate, initials } from "@/lib/utils";
import type { CompanyWithOwner, PaginatedResult, CompanySize } from "@/types/crm";

const SIZE_OPTIONS: CompanySize[] = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];
const PAGE_SIZE = 25;

interface CompaniesTableProps {
  initialData: PaginatedResult<CompanyWithOwner>;
  canDelete: boolean;
}

export function CompaniesTable({ initialData, canDelete }: CompaniesTableProps) {
  const [result, setResult] = useState(initialData);
  const [search, setSearch] = useState("");
  const [size, setSize] = useState<CompanySize | "">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await listCompanies({
        search: search || undefined,
        size: size ? [size] : undefined,
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
  }, [search, size, page]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this company?")) return;
    setPendingDeleteId(id);
    const res = await deleteCompany(id);
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
            placeholder="Search name or domain…"
            onSearch={(v) => {
              setPage(1);
              setSearch(v);
            }}
          />
          <select
            value={size}
            onChange={(e) => {
              setPage(1);
              setSize(e.target.value as CompanySize | "");
            }}
            className="rounded-md border border-zinc-200 bg-white py-1.5 px-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none"
          >
            <option value="">All sizes</option>
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} employees
              </option>
            ))}
          </select>
        </div>

        <Link
          href="/dashboard/companies/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus className="size-4" />
          New company
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
              <th className="px-3 py-2.5 font-medium">Industry</th>
              <th className="px-3 py-2.5 font-medium">Contacts</th>
              <th className="px-3 py-2.5 font-medium">Open deals</th>
              <th className="px-3 py-2.5 font-medium">Owner</th>
              <th className="px-3 py-2.5 font-medium">Created</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((company) => (
              <tr key={company.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/dashboard/companies/${company.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {company.name}
                  </Link>
                  {company.domain && <p className="text-xs text-zinc-400">{company.domain}</p>}
                </td>
                <td className="px-3 py-2.5 text-zinc-600">{company.industry ?? "—"}</td>
                <td className="px-3 py-2.5 text-zinc-600 tabular-nums">{company.contact_count}</td>
                <td className="px-3 py-2.5 text-zinc-600 tabular-nums">
                  {company.open_deal_count > 0
                    ? `${company.open_deal_count} · ${formatCurrency(company.open_deal_value)}`
                    : "—"}
                </td>
                <td className="px-3 py-2.5">
                  {company.owner && (
                    <span
                      title={company.owner.full_name ?? company.owner.email}
                      className="flex size-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-white"
                    >
                      {initials(company.owner.full_name ?? company.owner.email)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-500">{formatDate(company.created_at)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/dashboard/companies/${company.id}/edit`}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label="Edit company"
                    >
                      <Pencil className="size-3.5" />
                    </Link>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(company.id)}
                        disabled={pendingDeleteId === company.id}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label="Delete company"
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
                  No companies match these filters.
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
