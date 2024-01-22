"use client"
import React, { useState } from "react";
import html2canvas from 'html2canvas';
import { jsPDF } from "jspdf";

interface Orientation {
  dx: number;
  dy: number;
//   puzzleIndex: number
}

const WordSearch: React.FC = () => {
  const [board, setBoard] = useState<string[][]>([]);
  const [inputWord, setInputWord] = useState<string>("");
  const [wordArray, setWordArray] = useState<string[]>([]);

  const getRandomInt = (max: number): number => {
    return Math.floor(Math.random() * Math.floor(max));
  };

  const placeWord = (board: string[][], word: string): string[][] => {
    const orientations: Orientation[] = [
      { dx: 1, dy: 0 }, // Horizontal
      { dx: 0, dy: 1 }, // Vertical
      { dx: 1, dy: 1 }, // Diagonal top-left to bottom right
      { dx: 1, dy: -1 }, // Diagonal bottom-left to top-right
    ];

    let placed = false;

    while (!placed) {
      const orientation: Orientation =
        orientations[getRandomInt(orientations.length)];
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

            board[row][col] = reverse ? word[word.length - 1 - i] : word[i];
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
          board[row][col] = String.fromCharCode(65 + getRandomInt(26)); // Random uppercase letter
        }
      }
    }

    return board;
  };

  const generatePuzzle = (): void => {
    let newBoard = Array.from({ length: 13 }, () =>
      Array(13).fill("-")
    ) as string[][];

    for (const word of wordArray) {
      newBoard = placeWord(newBoard, word);
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

        const imgWidth = 100;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.text(`wordsearch`, imgWidth / 2, imgHeight / 5)

        pdf.addImage(imgData, 'PNG', imgWidth / 2, imgHeight / 4, imgWidth, imgHeight);
        pdf.save(`wordsearch.pdf`);
    });
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

      <button className="btn btn-primary me-2" onClick={handleAddWord}>
        Add Word
      </button>

      <button className="btn btn-success" onClick={generatePuzzle}>
        Generate Puzzle
      </button>

      <button className="btn btn-primary mx-1" onClick={() => downloadPDF()}>Download</button>

    <div id={`wordsearch`}>
      <table className="table text-center w-50 table-bordered mt-3">
        <tbody>
          {board.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => (
                <td
                  className="p-1"
                  key={colIndex}
                  style={{ width: "25px", height: "20px" }}
                >
                  {cell}
                </td>
              ))}
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

    </div>
  );
};

export default WordSearch;
