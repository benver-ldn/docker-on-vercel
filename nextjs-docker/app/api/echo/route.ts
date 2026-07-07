import { NextRequest, NextResponse } from "next/server";

// Run on the Node.js server runtime inside the container.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    runtime: "nextjs",
    nodeVersion: process.version,
    message: "Hello from Next.js on Vercel",
  });
}

export async function POST(req: NextRequest) {
  let received: unknown = null;
  try {
    received = await req.json();
  } catch {
    received = null;
  }
  return NextResponse.json({ ok: true, received });
}
