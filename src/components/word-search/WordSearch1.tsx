"use client";
import React, { useMemo, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import CSVReader from "react-csv-reader";

interface Orientation {
  dx: number;
  dy: number;
}

const WordSearch1: React.FC = () => {
  const [boards, setBoards] = useState<string[][][]>([]);
  const [inputWord, setInputWord] = useState<string>("");
  const [wordArray, setWordArray] = useState<string[]>([
    // "PYTHON",
    // "HTML5",
  ]);

  const dividedArray : string[][] = useMemo(()=>{
    const wordsArrays: string[][] = [];
    for (let i = 0; i < wordArray.length; i += 10) {
      wordsArrays.push(wordArray.slice(i, i + 10));
    }
    return wordsArrays
  }, [wordArray])

  console.log("Divided arrays are: ",dividedArray)
  console.log("Our final Boards are: ", boards)


  const [horizontal, setHorizontal] = useState<boolean>(true);
  const [vertical, setVertical] = useState<boolean>(true);
  const [diagonalTopLeft, setDiagonalTopLeft] = useState<boolean>(true);
  const [diagonalBottomLeft, setDiagonalBottomLeft] = useState<boolean>(true);


  const [showSolution, setShowSolution] = useState<boolean>(false);

  // console.log(board);
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



  const handleAddWord = (): void => {
    if (inputWord.trim() !== "") {
      setWordArray((prevWordArray) => [...prevWordArray, inputWord.toUpperCase()]);
      setInputWord("");
    } else {
      alert("Enter Appropriate word");
    }
  };
  

  const downloadPDF = () => {
    const componentRef = document.getElementById(`wordsearch`) as HTMLElement;

    html2canvas(componentRef).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 150;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 30, 10, imgWidth, imgHeight);
      pdf.save(`wordsearch.pdf`);
    });
  };

  const generatePuzzleForWords = (wordsArray: string[]): string[][] => {
    let newBoard = Array.from({ length: 13 }, () => Array(13).fill("-")) as string[][];
  
    const selectedDirections: Orientation[] = [];
    if (horizontal) selectedDirections.push({ dx: 1, dy: 0 });
    if (vertical) selectedDirections.push({ dx: 0, dy: 1 });
    if (diagonalTopLeft) selectedDirections.push({ dx: 1, dy: 1 });
    if (diagonalBottomLeft) selectedDirections.push({ dx: 1, dy: -1 });
  
    for (const word of wordsArray) {
      newBoard = placeWord(newBoard, word, selectedDirections);
    }
  
    // setBoards(dividedArray);
    return fillEmpty(newBoard);
  };

  
  // useEffect(() => {
  //   setBoards(dividedArray);
  // }, [dividedArray]);
  
  const handleFileUpload = (data: string[][], fileInfo: any): void => {
    // Extract words from CSV data
    const wordsFromFile = data.map((item) => item[0]);
    setWordArray([...wordArray, ...wordsFromFile]);

  };

 

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
      <div className="d-flex align-items-center mb-3">
        <label className=" fw-bold me-2">Upload CSV</label>
        <CSVReader
          onFileLoaded={handleFileUpload}
          parserOptions={{
            header: false,
            dynamicTyping: true,
            skipEmptyLines: true,
          }}
        />
      </div>

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

      <button className="btn btn-success"  onClick={() =>{
        setBoards([])
        dividedArray.map((single_array, i)=>{
          setBoards(prevBoards=>{
            return [
              ...prevBoards,
              generatePuzzleForWords(single_array)
            ]
          })
        })
      }}>
        Generate Puzzles
      </button>

      <button className="btn btn-primary mx-1" onClick={() => downloadPDF()}>
        Download
      </button>

      <button
        className="btn btn-dark"
        onClick={() => setShowSolution(!showSolution)}
      >
        {showSolution ? `Hide` : `Show`} Solution
      </button>

      <div className="row w-75">
        {boards.map((single_board, single_board_index) => {
          return (
            <div id={`wordsearch`} className="col-md-6">
              <SinglePuzzle board={single_board} key={single_board_index} />
            </div>
          );
        })}

        <div className="mt-3">
          <h5>Word List:</h5>
          <ul>
            {wordArray.map((word, index) => (
              <li key={index}>{word}</li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default WordSearch1;

interface SinglePuzzleProp {
  board: string[][];
}
const SinglePuzzle: React.FC<SinglePuzzleProp> = ({ board }) => {
  return (
    <div>
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
                    <span
                      style={{
                        background: parsedCell?.orignalLetter && "antiquewhite",
                      }}
                    >
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
  );
};
