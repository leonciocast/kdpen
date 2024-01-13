'use client';
import React, { ChangeEvent, useEffect, useMemo } from 'react';
import useSudoku from './useSudoku';
import { Difficulty } from 'sudoku-gen/dist/types/difficulty.type';
import { SudokuHookType } from '@/types/sudoku';
interface ComponentProps {
    styles: any
}


const SudokuGenerator: React.FC<ComponentProps> = ({ styles }) => {
    const [showSolution, setShowSolution] = React.useState<boolean>(false)
    const [numberOfPuzzles, setNumberOfPuzzles] = React.useState<number>(10)



    const [difficulty, setDifficulty] = React.useState<Difficulty>("easy")

    const sudoku = useSudoku(difficulty)
    const zippedArray = useMemo(() => zip(sudoku.genMatrix.board, sudoku.genMatrix.board_solution), [sudoku.genMatrix])
    const handleCellChange = (
        row: number,
        col: number,
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const value = event.target.value;
        const newBoard = [...sudoku.genMatrix.board];
        newBoard[row][col] = value === "" ? 0 : parseInt(value, 10);
        sudoku.setSudokuMatrix((prev) => {
            return {
                board_solution: prev.board_solution,
                board: newBoard
            }
        })
    };
    const handleCellFocus = (
        row: number,
        col: number,
        e: React.FocusEvent<HTMLInputElement>,
    ) => {
        console.log(row, col, e.target.value)
        // [row][col]
    }
    function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
        const result: [T, U][] = [];
        const length = Math.min(arr1.length, arr2.length);

        for (let i = 0; i < length; i++) {
            result.push([arr1[i], arr2[i]]);
        }

        return result;
    }


    function render_cell_value(cell: number, solution_cell: number): number | string {
        if (showSolution) {
            return solution_cell
        } else {
            if (cell === 0) {
                return ""
            } else {
                return cell
            }
        }
    }


    return (
        <>
            <div className="d-flex flex-row justify-content-center align-items-center my-2">

                <select
                    id="difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="form-select w-25 mx-1"
                    aria-label="Select difficulty"
                >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                </select>
                <button
                    className="btn btn-primary mx-1"
                    onClick={() => {
                        setShowSolution(false)
                        sudoku.fetchSudoku()
                    }}
                >
                    Regenerate
                </button>
                {
                    sudoku.genMatrix.board.length !== 0 && (
                        <button
                            className="btn btn-primary mx-1"
                            onClick={() => setShowSolution(!showSolution)}
                        >
                            {showSolution ? "Hide" : "Show"} Solution
                        </button>
                    )
                }

            </div>
            <div className='row justify-content-center'>
                <div className="col-6">
                    <table className={styles.sudoku_container}>
                        <tbody>
                            {zippedArray.map(([row, solutionRow], rowIndex) => (
                                <tr key={rowIndex}>
                                    {zip(row, solutionRow).map(([cell, solutionCell], colIndex) => (
                                        <td className="p-1" key={colIndex}>
                                            <input
                                                type="text"
                                                maxLength={1}
                                                // value={cell === 0 ? "" : cell !== 0 && showSolution ? solutionCell : cell}
                                                value={render_cell_value(cell, solutionCell)}
                                                readOnly={cell === solutionCell}
                                                disabled={showSolution}
                                                onChange={(e) => handleCellChange(rowIndex, colIndex, e)}
                                                className={`form-control`}
                                                onFocus={(e) => handleCellFocus(rowIndex, colIndex, e)}

                                                style={{
                                                    color: "black",
                                                    width: "3rem",
                                                    height: "3rem",
                                                    fontSize: "2rem",
                                                    textAlign: "center",
                                                    background: cell === 0 ? "white" : cell !== 0 && cell !== solutionCell ? "red" : "darkseagreen"
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </>
    )
}

export default SudokuGenerator;
