export default function Loading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex gap-4 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="w-64 shrink-0 space-y-3">
            <div className="h-4 w-1/2 rounded bg-zinc-200" />
            {Array.from({ length: 3 }).map((_, card) => (
              <div key={card} className="h-20 rounded-lg border border-zinc-200 bg-white" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
