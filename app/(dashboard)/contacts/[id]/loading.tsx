export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3 animate-pulse">
      <div className="lg:col-span-1">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-zinc-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-zinc-200" />
              <div className="h-2 w-1/2 rounded bg-zinc-100" />
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            <div className="h-3 w-full rounded bg-zinc-100" />
            <div className="h-3 w-4/5 rounded bg-zinc-100" />
            <div className="h-3 w-3/5 rounded bg-zinc-100" />
          </div>
        </div>
      </div>
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="h-40 rounded-lg border border-zinc-200 bg-white" />
        <div className="h-40 rounded-lg border border-zinc-200 bg-white" />
      </div>
    </div>
  );
}
