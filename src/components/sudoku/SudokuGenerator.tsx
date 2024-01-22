'use client';
import React, { ChangeEvent, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Difficulty } from 'sudoku-gen/dist/types/difficulty.type';
import useSudoku from './useSudoku';
import { downloadPuzzlesAsPDF } from '@/utils';
import { PuzzleType } from '@/types/sudoku';
import { jsPDF } from "jspdf";

interface SudokuGeneratorComponentProps {
    styles: any
}
interface SingleSudokuComponentProps {
    styles: any,
    puzzle: PuzzleType,
    puzzleIndex: number
}


const SudokuGenerator: React.FC<SudokuGeneratorComponentProps> = ({ styles }) => {

    const [numberOfPuzzles, setNumberOfPuzzles] = React.useState<number>(1)
    const [difficulty, setDifficulty] = React.useState<Difficulty>("easy")

    const sudoku = useSudoku(difficulty)

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
                <input type='number' className='form-control w-25 mx-1' value={numberOfPuzzles} onChange={(e) => setNumberOfPuzzles(_ => {
                    let __changed_value = parseInt(e.target.value, 10)
                    if (__changed_value < 0) {
                        __changed_value = 0
                    } else if (__changed_value > 100) {
                        __changed_value = 100
                    } else {
                        __changed_value = __changed_value
                    }
                    return __changed_value
                })} />
                <button
                    className="btn btn-primary mx-1"
                    onClick={() => {
                        // setShowSolution(false)
                        sudoku.generateNumberOfPuzzles(numberOfPuzzles)
                    }}
                >
                    Regenerate
                </button>
                {/* {
                    sudoku.listOfPuzzles.length !== 0 && (
                        <button
                            className="btn btn-primary mx-1"
                            onClick={() => setShowSolution(!showSolution)}
                        >
                            {showSolution ? "Hide" : "Show"} Solution
                        </button>
                    )
                } */}


            </div>
            <div className="row row-cols-1 row-cols-md-3 g-4">
                {
                    sudoku.listOfPuzzles.map((puzzle, puzzleIndex) => {

                        return (
                            <div className="col" key={puzzleIndex}>
                                <SingleSudoku puzzle={puzzle} styles={styles} key={puzzleIndex} puzzleIndex={puzzleIndex} />
                            </div>
                        )
                    })

                }
            </div>
        </>
    )
}

export default SudokuGenerator;

const downloadPDF = (id: number) => {
    const componentRef = document.getElementById(`sudoku_${id}`) as HTMLElement;

    html2canvas(componentRef).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF ({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',

        });

        const imgWidth = 100;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.text(`Sudoku ${id + 1}`, imgWidth / 2, imgHeight / 5)

        pdf.addImage(imgData, 'PNG', imgWidth / 2, imgHeight / 4, imgWidth, imgHeight);
        pdf.save(`Sudoku ${id + 1}.pdf`);
    });
};
const SingleSudoku: React.FC<SingleSudokuComponentProps> = ({ puzzle, styles, puzzleIndex }) => {
    const [showSolution, setShowSolution] = React.useState<boolean>(false)

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
    function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
        const result: [T, U][] = [];
        const length = Math.min(arr1.length, arr2.length);

        for (let i = 0; i < length; i++) {
            result.push([arr1[i], arr2[i]]);
        }

        return result;
    }


    return (
        <>
            <div className="card">
                <div className="card-body">
                    <div id={`sudoku_${puzzleIndex}`}>

                        <table className={styles.sudoku_container}>
                            <tbody>
                                {zip(puzzle.board, puzzle.board_solution).map(([row, solutionRow], rowIndex) => (
                                    <tr key={rowIndex}>
                                        {zip(row, solutionRow).map(([cell, solutionCell], colIndex) => (
                                            <td className="p-1" key={colIndex}>
                                                <input
                                                    type="text"
                                                    maxLength={1}
                                                    // value={cell === 0 ? "" : cell !== 0 && showSolution ? solutionCell : cell}
                                                    value={render_cell_value(cell, solutionCell)}
                                                    readOnly={true}
                                                    disabled={showSolution}
                                                    // onChange={(e) => handleCellChange(rowIndex, colIndex, puzzleIndex, e)}
                                                    className={`form-control`}
                                                    // onFocus={(e) => handleCellFocus(rowIndex, colIndex, e)}

                                                    style={{
                                                        color: "black",
                                                        // width: "3rem",
                                                        // height: "3rem",
                                                        // fontSize: "2rem",
                                                        // textAlign: "center",
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
            </div>

            <button
                className="btn btn-primary mx-1"
                onClick={() => setShowSolution(!showSolution)}
            >
                {showSolution ? "Hide" : "Show"} Solution
            </button>
            <button className="btn btn-primary mx-1" onClick={() => downloadPDF(puzzleIndex)}>Download</button>
        </>
    )
}

