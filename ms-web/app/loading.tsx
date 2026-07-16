export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
      <div className="max-w-2xl">
        <div className="h-3 w-40 animate-pulse rounded bg-paper-3" />
        <div className="mt-4 h-8 w-56 animate-pulse rounded bg-paper-3" />
        <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-paper-3" />
      </div>

      <div className="mt-8 h-12 w-full animate-pulse rounded-control bg-paper-3" />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-card border border-rule p-5">
            <div className="h-2.5 w-16 animate-pulse rounded bg-paper-3" />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="h-4 w-32 animate-pulse rounded bg-paper-3" />
              <div className="h-4 w-12 animate-pulse rounded bg-paper-3" />
            </div>
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-paper-3" />
            <div className="mt-1.5 h-3 w-3/4 animate-pulse rounded bg-paper-3" />
            <div className="mt-4 flex items-center justify-between border-t border-rule pt-3">
              <div className="h-3 w-16 animate-pulse rounded bg-paper-3" />
              <div className="h-3 w-20 animate-pulse rounded bg-paper-3" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
