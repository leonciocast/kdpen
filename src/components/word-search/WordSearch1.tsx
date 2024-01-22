"use client"
import React, { useState } from "react";

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
  const [wordArray, setWordArray] = useState<string[]>(["JAVASCRIPT", "PYTHON", "HTML5", "CSS3", "REACT"]);
  const [horizontal, setHorizontal] = useState<boolean>(true);
  const [vertical, setVertical] = useState<boolean>(true);
  const [diagonalTopLeft, setDiagonalTopLeft] = useState<boolean>(true);
  const [diagonalBottomLeft, setDiagonalBottomLeft] = useState<boolean>(true);
console.log(board)
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
      const orientation =
        directions[getRandomInt(directions.length)];
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
                
                randomLetter : null,
                orignalLetter : reverse ? word[word.length - 1 - i] : word[i],
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
          board[row][col] =JSON.stringify({
            randomLetter : String.fromCharCode(65 + getRandomInt(26)),
            orignalLetter : null,
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

  // Assuming board is an HTML element with the id "board"

console.log("sss", wordArray);


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

      <table className="table text-center w-50 table-bordered mt-3">
        <tbody>
          {board.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => {

                let parsedCell = JSON.parse(cell)
                
                
                return (
                <td
                  className="p-1"
                  key={colIndex}
                  style={{ width: "25px", height: "20px", background : parsedCell?.orignalLetter ? "gray" : "white" }}
                >

                    {
                        parsedCell?.orignalLetter ? parsedCell?.orignalLetter :parsedCell?.randomLetter 
                    }
                 
                </td>
              )})}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3">
        <h5>Word List:</h5>
        <ul>
          {wordArray.map((word, index) => (
            <li key={index}>{word}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default WordSearch1;
