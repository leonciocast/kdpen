import type { Metadata } from "next";
import SudokuGenerator from "@/components/sudoku/SudokuGenerator";

export const metadata: Metadata = { title: "Sudoku" };

export default function Page() {
  return <SudokuGenerator />;
}
