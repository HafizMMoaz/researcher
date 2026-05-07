import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medical Research Intelligence Platform",
  description:
    "AI-powered medical research workspace with OpenAI chat, safe SQL generation, and embedded Metabase dashboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
