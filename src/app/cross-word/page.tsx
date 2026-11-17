import type { Metadata } from "next";
import CrossWordGenerator from "@/components/cross-word/CrossWordGenerator";

export const metadata: Metadata = { title: "Crossword" };

export default function Page() {
  return <CrossWordGenerator />;
}
