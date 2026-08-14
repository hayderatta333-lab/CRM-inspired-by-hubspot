import Link from "next/link";
import { LayoutDashboard, Users, Building2, KanbanSquare, Settings } from "lucide-react";
import type { OrgRole } from "@/types/crm";
import { isManagerRole } from "@/types/crm";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/companies", label: "Companies", icon: Building2 },
  { href: "/dashboard/deals", label: "Deals", icon: KanbanSquare },
];

export function Sidebar({ orgName, role }: { orgName: string; role: OrgRole }) {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-4">
        <p className="truncate text-sm font-semibold text-zinc-900">{orgName}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}

        {isManagerRole(role) && (
          <Link
            href="/dashboard/settings/organization"
            className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <Settings className="size-4" />
            Settings
          </Link>
        )}
      </nav>
    </aside>
  );
}
