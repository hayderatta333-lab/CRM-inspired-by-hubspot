export default function Loading() {
  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-zinc-200 bg-white animate-pulse">
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-200 p-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-zinc-100" />
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="h-4 w-32 rounded bg-zinc-100" />
      </div>
    </div>
  );
}
