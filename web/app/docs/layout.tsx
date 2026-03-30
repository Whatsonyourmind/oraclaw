import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Docs",
  description:
    "Interactive API documentation for OraClaw. Explore 17 endpoints with live examples, request/response schemas, and code generation.",
  alternates: {
    canonical: "/docs",
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
