
import { DifficultyType, SudokuArraysType, SudokuHookType, SudokuType } from '@/types/sudoku';
import { useEffect, useState } from 'react';
import { getSudoku } from 'sudoku-gen';



const useSudoku = (difficulty: DifficultyType = "easy"): SudokuHookType => {

    const [listOfPuzzles, setListOfPuzzles] = useState<SudokuArraysType[]>([])


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


        return {
            board: convertArrayTo2DArray(board_array),
            board_solution: convertArrayTo2DArray(board_solution_array),
        };
    };
    const fetchSudoku = () => {
        let final_sudoku = null
        try {
            final_sudoku = convertSudokuToArrays(getSudoku(difficulty))
        } catch (error) {
            final_sudoku = null
        }
        return final_sudoku
    };

    function generateNumberOfPuzzles(numberOfPuzzles: number = 1) {
        setListOfPuzzles([])

        for (let i = 0; i < numberOfPuzzles; i++) {
            setListOfPuzzles((p) => {
                const newMatrix = fetchSudoku()

                return [
                    ...(p || []), // Ensure p is not null or undefined
                    ...(newMatrix ? [newMatrix] : []), // Include newMatrix only if it's not null
                ];
            });
            // const newMatrix = fetchSudoku()
            // setListOfPuzzles(newMatrix ? [newMatrix] : [])

        }
    }







    return { generateNumberOfPuzzles, listOfPuzzles, setListOfPuzzles };
};

export default useSudoku;
