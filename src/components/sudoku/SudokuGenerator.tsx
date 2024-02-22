'use client';
import React, {useState } from 'react';
import html2canvas from 'html2canvas';
import { Difficulty } from 'sudoku-gen/dist/types/difficulty.type';
import useSudoku from './useSudoku';
import { PuzzleType, SudokuHookType } from '@/types/sudoku';
import { jsPDF } from "jspdf";
import { BsArrowRepeat,BsEye, BsEyeSlash,BsPrinter,BsDownload     } from "react-icons/bs";

interface SudokuGeneratorComponentProps {
    styles: any
    sudoku?: SudokuHookType 
}
interface SingleSudokuComponentProps {
    styles: any,
    puzzle: PuzzleType,
    puzzleIndex: number
}


const SudokuGenerator: React.FC<SudokuGeneratorComponentProps> = ({ styles }) => {
    const [showAllSolutions, setShowAllSolutions] = useState<boolean>(false); 
    const [showSolution, setShowSolution] = useState<boolean>(false); 
    const [numberOfPuzzles, setNumberOfPuzzles] = React.useState<number>(1)
    const [difficulty, setDifficulty] = React.useState<Difficulty>("easy")
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    const sudoku = useSudoku(difficulty)
   
    const printAllPuzzles = () => {
      setIsPrinting(true);
      const canvasList: HTMLCanvasElement[] = [];
      let renderedCount = 0;
  
      const renderNextCanvas = (puzzleIndex: number) => {
          const componentRef = document.getElementById(`sudoku_${puzzleIndex}`) as HTMLElement;
          if (!componentRef) {
              setIsPrinting(false);
              console.error(`Component with id sudoku_${puzzleIndex} not found.`);
              return;
          }
  
          html2canvas(componentRef, {
              useCORS: true,
              scale: 2
          }).then(canvas => {
              canvasList.push(canvas);
              renderedCount++;
  
              if (renderedCount === sudoku.listOfPuzzles.length) {
                  printCanvasList(canvasList);
              } else {
                  renderNextCanvas(puzzleIndex + 1);
              }
          }).catch(error => {
              setIsPrinting(false);
              console.error('Error rendering canvas:', error);
          });
      };
  
      const printCanvasList = (canvasList: HTMLCanvasElement[]) => {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
              printWindow.document.write('<html><head><title>All Sudoku Puzzles</title></head><body>');
              canvasList.forEach((canvas, index) => {
                  printWindow.document.write('<div style="page-break-before: always;">');
                  printWindow.document.write(`<h4 style="text-align: center;">Sudoku Puzzle: ${index + 1}</h4>`);
                  printWindow.document.write(`<img src="${canvas.toDataURL("image/png")}" style="width: 80%; display:flex;margin:auto" />`);
                  printWindow.document.write('</div>');
              });
              printWindow.document.write('</body></html>');
              printWindow.document.close();
              printWindow.print();
          } else {
              console.error('Failed to open print window');
          }
          setIsPrinting(false);
      };
  
      if (sudoku.listOfPuzzles.length > 0) {
          renderNextCanvas(0);
      } else {
          setIsPrinting(false);
          console.error('No puzzles to print.');
      }
  };
  
  //   const downloadAllPDF = (puzzles: PuzzleType[]) => {
  //     setIsDownloading(true);
  //     const pdf = new jsPDF({
  //         orientation: "portrait",
  //         unit: "mm",
  //         format: "a4",
  //     });
  
  //     puzzles.forEach((puzzle, index) => {
  //         const componentRef = document.getElementById(`sudoku_${index}`) as HTMLElement;
  //         if (!componentRef || !componentRef.innerHTML.trim()) {
  //             return;
  //         }
  
  //         const dpi = 400; 
  //         html2canvas(componentRef, { scale: dpi / 156 }).then((canvas) => {
  //             const imgData = canvas.toDataURL("image/png");
  //             const imgWidth = 150;
  //             const imgHeight = (canvas.height * imgWidth) / canvas.width;
  //             if (index !== 0) {
  //                 pdf.addPage();
  //             }
  //             pdf.text(`Sudoku ${index + 1}`, 30, 20);
  //             pdf.addImage(imgData, "PNG", 30, 30, imgWidth, imgHeight);
  //             if (index === puzzles.length - 1) {
  //                 pdf.save("All_Sudokus.pdf");
  //             }
  //         });
  //     });
  // };
  const downloadAllPDF = (puzzles: PuzzleType[]) => {
    setIsDownloading(true);
    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const canvasList: HTMLCanvasElement[] = [];

    const renderNextPage = (index: number) => {
        if (index >= puzzles.length) {
            pdf.save("All_Sudokus.pdf");
            setIsDownloading(false);
            return;
        }

        const puzzle = puzzles[index];
        const componentRef = document.getElementById(`sudoku_${index}`) as HTMLElement;
        if (!componentRef || !componentRef.innerHTML.trim()) {
            renderNextPage(index + 1);
            return;
        }

        const dpi = 300;
        html2canvas(componentRef, { scale: dpi / 156 }).then((canvas) => {
            canvasList.push(canvas);
            const imgData = canvas.toDataURL("image/png");
            const imgWidth = 150;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            if (index !== 0) {
                pdf.addPage();
            }
            pdf.text(`Sudoku ${index + 1}`, 30, 20);
            pdf.addImage(imgData, "PNG", 30, 30, imgWidth, imgHeight);

            renderNextPage(index + 1);
        }).catch(error => {
            console.error('Error rendering canvas:', error);
            setIsDownloading(false);
        });
    };

    renderNextPage(0);
};

    
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
          <input
            type="number"
            className="form-control w-25 mx-1"
            value={numberOfPuzzles}
            onChange={(e) => {
              let newValue = parseInt(e.target.value, 10);
              if (newValue < 0) {
                newValue = 0;
              } else if (newValue > 24) {
                newValue = 24;
                alert("Maximum limit reached: 24 puzzles");
              }
              setNumberOfPuzzles(newValue);
            }}
          />
          <button
            className="btn btn-primary mx-1 text-nowrap"
            onClick={() => {
              const limit = Math.min(numberOfPuzzles, 24);
              sudoku.generateNumberOfPuzzles(limit);
            }}
            disabled={isPrinting || isDownloading}
          >
            <BsArrowRepeat />
            <span>{sudoku.length == 0  ? "Generate" : "Regenerate"}</span>
          </button>
          <button
            className="btn btn-primary mx-1 text-nowrap"
            onClick={() => setShowAllSolutions(!showAllSolutions)}
            disabled={isPrinting || isDownloading}
          >
            {showAllSolutions ? (
              <>
                <BsEyeSlash className="me-2 top-0" />
                Hide Solution
              </>
            ) : (
              <>
                <BsEye className="me-2 top-0" />
                Show Solution
              </>
            )}
          </button>
          <button
            className="btn btn-primary mx-1 my-2 text-nowrap"
            onClick={printAllPuzzles}
            disabled={isPrinting || isDownloading}
          >
            {isPrinting ? (
              <div
                className="spinner-border spinner-border-sm me-2"
                role="status"
              >
                <span className="visually-hidden">Loading...</span>
              </div>
            ) : null}
            <BsPrinter />
            <span className="ms-1"> Print </span>
          </button>
          
          <button
            className="btn btn-primary mx-1 my-2 text-nowrap"
            onClick={() => downloadAllPDF(sudoku.listOfPuzzles)}
            disabled={isPrinting || isDownloading}
          >
            {isDownloading ? (
              <div
                className="spinner-border spinner-border-sm me-2"
                role="status"
              >
                <span className="visually-hidden">Loading...</span>
              </div>
            ) : null}
            <BsDownload />
            <span> Download All </span>
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
        <div className="row row-cols-1 row-cols-md-3 g-4 pb-3">
          {sudoku.listOfPuzzles.map((puzzle, puzzleIndex) => (
            <div className="col" key={puzzleIndex}>
              <SingleSudoku
                puzzle={puzzle}
                styles={styles}
                key={puzzleIndex}
                puzzleIndex={puzzleIndex}
                showSolution={showAllSolutions ? true : showSolution}
              />
            </div>
          ))}
        </div>
      </>
    );
}

export default SudokuGenerator;


// const downloadSinglePDF = (puzzle: PuzzleType, id: number) => {
//     const componentRef = document.getElementById(`sudoku_${id}`) as HTMLElement;
//     const dpi = 400; 
//     html2canvas(componentRef, { scale: dpi / 96 }) 
//         .then((canvas) => {
//             const imgData = canvas.toDataURL("image/png");
//             const pdf = new jsPDF({
//                 orientation: "portrait",
//                 unit: "mm",
//                 format: "a4",
//             });

//             const imgWidth = 150;
//             const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
//             // pdf.rect(20, 15, imgWidth, imgHeight);  // for border 
//             pdf.text(`Sudoku ${id + 1}`, 30, 10);
//             pdf.addImage(imgData, "PNG", 30, 15, imgWidth, imgHeight);
//             pdf.save(`Sudoku_${id + 1}.pdf`);
//         });
// };



// const downloadPDF = (listOfPuzzles: PuzzleType[], puzzleIndex?: number) => {
//     if (puzzleIndex !== undefined) {
//         downloadSinglePDF(listOfPuzzles[puzzleIndex], puzzleIndex);
//     } else {
//         downloadAllPDF(listOfPuzzles);
//     }
// };

const SingleSudoku: React.FC<SingleSudokuComponentProps & { showSolution: boolean }> = ({ puzzle, styles, puzzleIndex, showSolution }) => {
    // const [localShowSolution, setLocalShowSolution] = React.useState<boolean>(false);
    function render_cell_value(cell: number, solution_cell: number): number | string {
        if (showSolution) {
            return solution_cell;
        } else {
            if (cell === 0) {
                return "";
            } else {
                return cell;
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
         <h4>Sudoku: {puzzleIndex + 1}</h4>
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

            {/* <button
                className="btn btn-primary mx-1 my-2"
                onClick={() => setLocalShowSolution(!localShowSolution)} 
            >
             {localShowSolution ? (
                    <>
                    <BsEyeSlash className="me-2 top-0"  />
                    Hide Solution
                    </>
                ) : (
                    <>
                    <BsEye className="me-2 top-0" />
                    Show Solution
                    </>
                )}
            </button> */}

            {/* <button className="btn btn-primary mx-1 my-2" onClick={() => downloadPDF(sudoku.listOfPuzzles, puzzleIndex)}>
                <BsArrowDownCircle /><span> Download </span>
            </button> */}
        </>
    )
}

