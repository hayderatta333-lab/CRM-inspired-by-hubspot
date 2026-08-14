"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

interface SearchInputProps {
  initialValue?: string;
  placeholder?: string;
  onSearch: (value: string) => void;
  debounceMs?: number;
}

export function SearchInput({
  initialValue = "",
  placeholder = "Search…",
  onSearch,
  debounceMs = 300,
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const handle = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
      />
    </div>
  );
}
