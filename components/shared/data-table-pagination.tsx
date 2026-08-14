"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function DataTablePagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: DataTablePaginationProps) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-1 py-3">
      <p className="text-xs text-zinc-500 tabular-nums">
        {totalCount === 0 ? "No results" : `${start}–${end} of ${totalCount}`}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600",
            "disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 text-xs text-zinc-500 tabular-nums">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600",
            "disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
