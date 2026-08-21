export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      <div>
        <div className="h-5 w-32 rounded bg-zinc-200" />
        <div className="mt-2 h-3 w-40 rounded bg-zinc-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg border border-zinc-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-lg border border-zinc-200 bg-white" />
        <div className="h-56 rounded-lg border border-zinc-200 bg-white" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-48 rounded-lg border border-zinc-200 bg-white lg:col-span-2" />
        <div className="h-48 rounded-lg border border-zinc-200 bg-white" />
      </div>
    </div>
  );
}
