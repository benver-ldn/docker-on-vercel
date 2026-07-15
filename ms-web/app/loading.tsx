export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Product Search</h1>
      <p className="mt-1 text-sm text-gray-500">
        Next.js → Spring Boot gateway → catalog + inventory + reviews microservices on Vercel.
      </p>
      <div className="mt-6 h-[42px] w-full max-w-md animate-pulse rounded-md bg-gray-100" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-4 w-12 rounded bg-gray-200" />
            </div>
            <div className="mt-2 h-3 w-20 rounded bg-gray-100" />
            <div className="mt-3 h-3 w-full rounded bg-gray-100" />
            <div className="mt-1 h-3 w-3/4 rounded bg-gray-100" />
            <div className="mt-4 flex items-center justify-between">
              <div className="h-3 w-16 rounded bg-gray-100" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
