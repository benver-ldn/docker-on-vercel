export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14 sm:py-20">
      <div className="h-3 w-28 animate-pulse rounded bg-paper-3" />
      <div className="mt-8 h-3 w-20 animate-pulse rounded bg-paper-3" />
      <div className="mt-3 h-10 w-3/4 animate-pulse rounded bg-paper-3" />
      <div className="mt-6 h-3 w-full animate-pulse rounded bg-paper-3" />
      <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-paper-3" />
      <div className="mt-8 grid grid-cols-1 overflow-hidden rounded-card border border-rule sm:grid-cols-2">
        <div className="h-14 animate-pulse bg-paper-3" />
        <div className="h-14 animate-pulse bg-paper-2" />
      </div>
    </main>
  );
}
