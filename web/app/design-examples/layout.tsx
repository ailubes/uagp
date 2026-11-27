import type { Metadata } from "next";
import "@/components/civic/civic.css";
import "./examples.css";

export const metadata: Metadata = { title: "Варіанти дизайну UAGP", robots: { index: false, follow: false } };

export default function ExamplesLayout({ children }: { children: React.ReactNode }) {
  return <div className="examples civic-surface">{children}</div>;
}
