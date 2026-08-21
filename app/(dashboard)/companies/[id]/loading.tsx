export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3 animate-pulse">
      <div className="flex flex-col gap-4 lg:col-span-1">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="h-4 w-2/3 rounded bg-zinc-200" />
          <div className="mt-4 space-y-2.5">
            <div className="h-3 w-full rounded bg-zinc-100" />
            <div className="h-3 w-4/5 rounded bg-zinc-100" />
            <div className="h-3 w-3/5 rounded bg-zinc-100" />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="h-3 w-1/3 rounded bg-zinc-200" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-zinc-100" />
            <div className="h-3 w-4/5 rounded bg-zinc-100" />
          </div>
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="h-40 rounded-lg border border-zinc-200 bg-white" />
      </div>
    </div>
  );
}
