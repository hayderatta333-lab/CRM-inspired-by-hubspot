import { requireOrgContext } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ROLE_LABELS } from "@/types/crm";
import { initials } from "@/lib/utils";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext();

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar orgName={ctx.orgName} role={ctx.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-zinc-200 bg-white px-6 py-2.5">
          <span className="text-xs text-zinc-500">{ROLE_LABELS[ctx.role]}</span>
          <span className="flex size-7 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-medium text-white">
            {initials(ctx.profile.full_name ?? ctx.profile.email)}
          </span>
          <SignOutButton />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
