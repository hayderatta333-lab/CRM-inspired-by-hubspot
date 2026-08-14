export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold text-zinc-900">CRM</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
