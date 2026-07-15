import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">Product not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        That product doesn’t exist in the catalog.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
      >
        ← Back to search
      </Link>
    </main>
  );
}
