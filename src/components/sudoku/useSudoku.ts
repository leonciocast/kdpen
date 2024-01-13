
import { DifficultyType, SudokuArraysType, SudokuHookType, SudokuType } from '@/types/sudoku';
import { useEffect, useState } from 'react';
import { getSudoku } from 'sudoku-gen';



const useSudoku = (difficulty: DifficultyType = "easy"): SudokuHookType => {
    const [generatedSudokuState, setSudokuState] = useState<SudokuType>({
        puzzle: '',
        solution: '',
        difficulty: difficulty,
    });
    const [sudokuMatrix, setSudokuMatrix] = useState<SudokuArraysType>({
        board: [],
        board_solution: []
    });

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const convertSudokuToArrays = (sudoku: SudokuType): SudokuArraysType => {

        const convertStringToArray = (str: string): number[] => {
            return str.split('').map((char) => {
                let result = char === '-' ? 0 : parseInt(char, 10)
                return result
            });
        }

        const convertArrayTo2DArray = (array: number[]): number[][] => {
            const result: number[][] = [];

            for (let i = 0; i < 9; i++) {
                result.push(array.slice(i * 9, (i + 1) * 9));
            }

            return result;
        }
        const board_array = convertStringToArray(sudoku.puzzle)
        const board_solution_array = convertStringToArray(sudoku.solution)
        // const countNonZeros = (arr: number[]): number => {
        //     return arr.reduce((count, num) => (num !== 0 ? count + 1 : count), 0);
        // };
        // console.log(countNonZeros(board_array))

        return {
            board: convertArrayTo2DArray(board_array),
            board_solution: convertArrayTo2DArray(board_solution_array),
        };
    };
    const fetchSudoku = async () => {
        try {
            setLoading(true);
            const generatedSudoku = getSudoku(difficulty);
            const final_sudoku = convertSudokuToArrays(generatedSudoku)
            setSudokuState(generatedSudoku);
            setSudokuMatrix(final_sudoku);
            setLoading(false);
        } catch (error) {
            setError('Error fetching Sudoku puzzle.');
            setLoading(false);
        }
    };
    

   




    return { genSudoku: generatedSudokuState, genMatrix: sudokuMatrix, loading, error, fetchSudoku, setSudokuMatrix };
};

export default useSudoku;
