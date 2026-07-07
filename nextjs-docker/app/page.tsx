// Force dynamic rendering so this executes in the container at request time
// (proves the server runtime, not a static prerender).
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", lineHeight: 1.6 }}>
      <h1>Next.js in Docker on Vercel ▲</h1>
      <p>This page is server-rendered inside a Docker container running as a Vercel Function.</p>
      <ul>
        <li>Runtime: Next.js (App Router)</li>
        <li>Node: {process.version}</li>
        <li>Region: {process.env.VERCEL_REGION ?? "local"}</li>
      </ul>
      <p>
        API: <code>GET /api/echo</code> and <code>POST /api/echo</code>
      </p>
    </main>
  );
}
