"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut()}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    >
      <LogOut className="size-3.5" />
      Sign out
    </button>
  );
}
