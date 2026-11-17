import type { Metadata } from "next";
import WordSearch from "@/components/word-search/WordSearch";

export const metadata: Metadata = { title: "Word Search" };

export default function Page() {
  return <WordSearch />;
}
