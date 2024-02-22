import { Sudoku } from "sudoku-gen/dist/types/sudoku.type";
import { Difficulty } from 'sudoku-gen/dist/types/difficulty.type';

export type DifficultyType = Difficulty
export type SudokuType = Sudoku
export type PuzzleType = {
    board: number[][];
    board_solution: number[][];

    // showSolution: boolean;
};
export interface SudokuHookType {
    length: number;
    // loading: boolean;
    // error: string | null;
    // genSudoku: SudokuType | undefined;
    // genMatrix: SudokuArraysType,
    listOfPuzzles: PuzzleType[],
    setListOfPuzzles: React.Dispatch<React.SetStateAction<PuzzleType[]>>
    generateNumberOfPuzzles: (numberOfPuzzles: number) => void,
    // setSudokuMatrix: React.Dispatch<React.SetStateAction<SudokuArraysType>>
}