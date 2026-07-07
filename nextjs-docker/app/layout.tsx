export const metadata = {
  title: "Next.js in Docker on Vercel",
  description: "Dockerized Next.js running as a Vercel container function",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
