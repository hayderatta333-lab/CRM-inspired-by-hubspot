import Link from "next/link";

const TABS = [
  { href: "/settings/organization", label: "Organization" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/pipelines", label: "Pipelines" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex gap-1 border-b border-zinc-200 bg-white px-6 pt-3">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
