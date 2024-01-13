import { Sudoku } from "sudoku-gen/dist/types/sudoku.type";
import { Difficulty } from 'sudoku-gen/dist/types/difficulty.type';

export type DifficultyType = Difficulty
export type SudokuType = Sudoku
export type SudokuArraysType = {
    board: number[][];
    board_solution: number[][];
};
export interface SudokuHookType {
    loading: boolean;
    error: string | null;
    genSudoku: SudokuType | undefined;
    genMatrix: SudokuArraysType,
    fetchSudoku: () => void,
    setSudokuMatrix: React.Dispatch<React.SetStateAction<SudokuArraysType>>
}