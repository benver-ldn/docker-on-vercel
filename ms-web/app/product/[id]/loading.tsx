export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
      <div className="mt-6 animate-pulse rounded-lg border border-gray-200 p-6">
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="h-7 w-48 rounded bg-gray-200" />
          <div className="h-6 w-16 rounded bg-gray-200" />
        </div>
        <div className="mt-4 h-3 w-full rounded bg-gray-100" />
        <div className="mt-1 h-3 w-2/3 rounded bg-gray-100" />
        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="h-3 w-16 rounded bg-gray-100" />
          <div className="h-3 w-20 rounded bg-gray-100" />
        </div>
      </div>
    </main>
  );
}
