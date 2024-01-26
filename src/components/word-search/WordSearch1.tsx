"use client";
import React, { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import CSVReader from "react-csv-reader";

interface Orientation {
  dx: number;
  dy: number;
}
// interface CellType {
//     letter : string,
//     isRandom : boolean
// }
const WordSearch1: React.FC = () => {
  const [board, setBoard] = useState<string[][]>([]);
  const [inputWord, setInputWord] = useState<string>("");
  const [wordArray, setWordArray] = useState<string[]>([
    
    "PYTHON",
    "HTML5",
    
  ]);
  const [horizontal, setHorizontal] = useState<boolean>(true);
  const [vertical, setVertical] = useState<boolean>(true);
  const [diagonalTopLeft, setDiagonalTopLeft] = useState<boolean>(true);
  const [diagonalBottomLeft, setDiagonalBottomLeft] = useState<boolean>(true);
  const [showSolution, setShowSolution] = useState<boolean>(false);

  console.log(board);
  const getRandomInt = (max: number): number => {
    return Math.floor(Math.random() * Math.floor(max));
  };

  const placeWord = (
    board: string[][],
    word: string,
    directions: Orientation[]
  ): string[][] => {
    let placed = false;

    while (!placed) {
      const orientation = directions[getRandomInt(directions.length)];
      const reverse = Math.random() < 0.5;

      const startRow = getRandomInt(board.length);
      const startCol = getRandomInt(board[startRow].length);

      const endRow = startRow + orientation.dy * (word.length - 1);
      const endCol = startCol + orientation.dx * (word.length - 1);

      if (
        endRow >= 0 &&
        endRow < board.length &&
        endCol >= 0 &&
        endCol < board[startRow].length
      ) {
        let spaceAvailable = true;

        for (let i = 0; i < word.length; i++) {
          const row = startRow + i * orientation.dy;
          const col = startCol + i * orientation.dx;

          if (board[row][col] !== "-" && board[row][col] !== word[i]) {
            spaceAvailable = false;
            break;
          }
        }

        if (spaceAvailable) {
          for (let i = 0; i < word.length; i++) {
            const row = startRow + i * orientation.dy;
            const col = startCol + i * orientation.dx;

            board[row][col] = JSON.stringify({
              randomLetter: null,
              orignalLetter: reverse ? word[word.length - 1 - i] : word[i],
            });
          }
          placed = true;
        }
      }
    }

    return board;
  };

  const fillEmpty = (board: string[][]): string[][] => {
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        if (board[row][col] === "-") {
          board[row][col] = JSON.stringify({
            randomLetter: String.fromCharCode(65 + getRandomInt(26)),
            orignalLetter: null,
          }); // Random uppercase letter
        }
      }
    }

    return board;
  };

  const generatePuzzle = (): void => {
    let newBoard = Array.from({ length: 13 }, () =>
      Array(13).fill("-")
    ) as string[][];

    const selectedDirections: Orientation[] = [];

    if (horizontal) selectedDirections.push({ dx: 1, dy: 0 });
    if (vertical) selectedDirections.push({ dx: 0, dy: 1 });
    if (diagonalTopLeft) selectedDirections.push({ dx: 1, dy: 1 });
    if (diagonalBottomLeft) selectedDirections.push({ dx: 1, dy: -1 });

    for (const word of wordArray) {
      newBoard = placeWord(newBoard, word, selectedDirections);
    }

    newBoard = fillEmpty(newBoard);
    setBoard(newBoard);
  };

  const handleAddWord = (): void => {
    if (inputWord.trim() !== "" && wordArray.length <= 9) {
      setWordArray([...wordArray, inputWord.toUpperCase()]);
      setInputWord("");
    } else {
      alert("You have reached the maximum number of words!");
    }
  };

  const downloadPDF = () => {
    const componentRef = document.getElementById(`wordsearch`) as HTMLElement;

    html2canvas(componentRef).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF ({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',

        });

        const imgWidth = 150;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        // pdf.text(`crossword`,0,0)

        pdf.addImage(imgData, 'PNG', 30,10, imgWidth, imgHeight);
        pdf.save(`wordsearch.pdf`);
    });
};
const handleFileUpload = (data: string[][], fileInfo: any): void => {
  const wordsFromFile = data.map((item) => item[0]);
  setWordArray([...wordArray, ...wordsFromFile]);
  console.log("test", wordsFromFile)
};

  // Assuming board is an HTML element with the id "board"
  return (
    <div className="container mt-5">
      <div className="mb-3">
        <label htmlFor="wordInput" className="form-label">
          Enter Word:
        </label>
        <input
          type="text"
          className="form-control w-50"
          id="wordInput"
          value={inputWord}
          onChange={(e) => setInputWord(e.target.value)}
        />
      </div>

      <label className="btn btn-info me-2">
        Upload CSV
        <CSVReader
          onFileLoaded={handleFileUpload}
          parserOptions={{
            header: false,
            dynamicTyping: true,
            skipEmptyLines: true,
          }}
        />
      </label>

      <div className="mb-3">
        <label className="form-check-label me-2">
          <input
            type="checkbox"
            className="form-check-input"
            checked={horizontal}
            onChange={() => setHorizontal(!horizontal)}
          />
          Horizontal
        </label>

        <label className="form-check-label me-2">
          <input
            type="checkbox"
            className="form-check-input"
            checked={vertical}
            onChange={() => setVertical(!vertical)}
          />
          Vertical
        </label>

        <label className="form-check-label me-2">
          <input
            type="checkbox"
            className="form-check-input"
            checked={diagonalTopLeft}
            onChange={() => setDiagonalTopLeft(!diagonalTopLeft)}
          />
          Diagonal (Top-Left to Bottom-Right)
        </label>

        <label className="form-check-label">
          <input
            type="checkbox"
            className="form-check-input"
            checked={diagonalBottomLeft}
            onChange={() => setDiagonalBottomLeft(!diagonalBottomLeft)}
          />
          Diagonal (Bottom-Left to Top-Right)
        </label>
      </div>

      <button className="btn btn-primary me-2" onClick={handleAddWord}>
        Add Word
      </button>
      

      <button className="btn btn-success" onClick={generatePuzzle}>
        Generate Puzzle
      </button>

      <button className="btn btn-primary mx-1" onClick={() => downloadPDF()}>
        Download
      </button>

      <button className="btn btn-dark" onClick={() => setShowSolution(!showSolution)}>{showSolution ? `Hide`:`Show`} Solution</button>

      
        <div className="row w-75">
          <div className="col-md-3 position-relative">
            <button
              className="carousel-control-prev"
              onClick={generatePuzzle}
              type="button"
              data-bs-target="#carouselExample"
              data-bs-slide="prev"
            >
              <span
                className="carousel-control-prev-icon bg-black z-1"
                aria-hidden="true"
              ></span>
              <span className="visually-hidden">Previous</span>
            </button>
          </div>
          
          <div id={`wordsearch`} className="col-md-6">
            <div id="carouselExample" className="carousel slide">
              <div className="carousel-inner">
                <div className="carousel-item active">
                    
                  <table className="table text-center w-100 table-bordered mt-3">
                    <tbody>
                      {board.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, colIndex) => {
                            let parsedCell = JSON.parse(cell);

                            return (
                              <td
                                className="p-1"
                                key={colIndex}
                                style={{
                                  width: "25px",
                                  height: "25px",
                                //   background: parsedCell?.orignalLetter && showSolution
                                //     ? "gray"
                                //     : "white",
                                }}
                              >
                                <span  style={{
                                 
                                  background: (parsedCell?.orignalLetter && showSolution)&& "antiquewhite",
                                }}>
                                {parsedCell?.orignalLetter
                                  ? parsedCell?.orignalLetter
                                  : parsedCell?.randomLetter}
                                    </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="carousel-item">
                <table className="table text-center w-100 table-bordered mt-3">
                    <tbody>
                      {board.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, colIndex) => {
                            let parsedCell = JSON.parse(cell);

                            return (
                              <td
                                className="p-1"
                                key={colIndex}
                                style={{
                                  width: "25px",
                                  height: "25px",
                                //   background: parsedCell?.orignalLetter && showSolution
                                //     ? "gray"
                                //     : "white",
                                }}
                              >
                                <span  style={{
                                 
                                  background: (parsedCell?.orignalLetter && showSolution)&& "antiquewhite",
                                }}>
                                {parsedCell?.orignalLetter
                                  ? parsedCell?.orignalLetter
                                  : parsedCell?.randomLetter}
                                    </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="carousel-item">
                <table className="table text-center w-100 table-bordered mt-3">
                    <tbody>
                      {board.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, colIndex) => {
                            let parsedCell = JSON.parse(cell);

                            return (
                              <td
                                className="p-1"
                                key={colIndex}
                                style={{
                                  width: "25px",
                                  height: "25px",
                                //   background: parsedCell?.orignalLetter && showSolution
                                //     ? "gray"
                                //     : "white",
                                }}
                              >
                                <span  style={{
                                 
                                  background: (parsedCell?.orignalLetter && showSolution)&& "antiquewhite",
                                }}>
                                {parsedCell?.orignalLetter
                                  ? parsedCell?.orignalLetter
                                  : parsedCell?.randomLetter}
                                    </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-3">
          <h5>Word List:</h5>
          <ul>
            {wordArray.map((word, index) => (
              <li key={index}>{word}</li>
            ))}
          </ul>
        </div>
          </div>
          

          <div className="col-md-3 position-relative">
            <button
              className="carousel-control-next"
              onClick={generatePuzzle}
              type="button"
              data-bs-target="#carouselExample"
              data-bs-slide="next"
            >
              <span
                className="carousel-control-next-icon bg-black z-1"
                aria-hidden="true"
              ></span>
              <span className="visually-hidden">Next</span>
            </button>
          </div>
        
        
      </div>
    </div>
  );
};

export default WordSearch1;
