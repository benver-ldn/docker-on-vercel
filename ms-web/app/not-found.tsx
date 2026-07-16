import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-3">404</p>
      <h1 className="mt-3 text-title font-semibold tracking-tight text-ink">
        Product not found
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        That product doesn’t exist in the catalog.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-control bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-2 active:translate-y-px"
      >
        ← Back to search
      </Link>
    </main>
  );
}
