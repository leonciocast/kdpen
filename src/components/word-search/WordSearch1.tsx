"use client";
import React, { useMemo, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import CSVReader from "react-csv-reader";
import { MdDelete } from "react-icons/md";

interface Orientation {
  dx: number;
  dy: number;
}

const WordSearch1: React.FC = () => {
  const [horizontal, setHorizontal] = useState<boolean>(true);
  const [vertical, setVertical] = useState<boolean>(true);
  const [diagonalTopLeft, setDiagonalTopLeft] = useState<boolean>(true);
  const [diagonalBottomLeft, setDiagonalBottomLeft] = useState<boolean>(true);

  const [boards, setBoards] = useState<string[][][]>([]);
  const [inputWord, setInputWord] = useState<string>("");
  const [wordArray, setWordArray] = useState<string[]>([]);
  const [dividedArray, setDividedArray] = useState<string[][]>([]);

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
      setWordArray((prevWordArray) => [
        ...prevWordArray,
        inputWord.toUpperCase(),
      ]);
      setInputWord("");
    } else {
      alert("Enter Appropriate word");
    }
  };
  const handleDelete = (index: number) => {
    const updatedWordsArray = [...wordArray];
    updatedWordsArray.splice(index, 1);
    setWordArray(updatedWordsArray);
  };

  const generatePuzzleForWords = (wordsArray: string[]): string[][] => {
    let newBoard = Array.from({ length: 13 }, () =>
      Array(13).fill("-")
    ) as string[][];

    const selectedDirections: Orientation[] = [];
    if (horizontal) selectedDirections.push({ dx: 1, dy: 0 });
    if (vertical) selectedDirections.push({ dx: 0, dy: 1 });
    if (diagonalTopLeft) selectedDirections.push({ dx: 1, dy: 1 });
    if (diagonalBottomLeft) selectedDirections.push({ dx: 1, dy: -1 });

    for (const word of wordsArray) {
      newBoard = placeWord(newBoard, word, selectedDirections);
    }

    return fillEmpty(newBoard);
  };

  const handleFileUpload = (data: string[][], fileInfo: any): void => {
    // Extract words from CSV data
    let wordsFromFile = data.map((item) => item[0]);

    wordsFromFile = wordsFromFile.map((word, i) => {
      return word.toUpperCase();
    });
    setWordArray([...wordArray, ...wordsFromFile]);
  };

  function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
    const result: [T, U][] = [];
    const length = Math.min(arr1.length, arr2.length);

    for (let i = 0; i < length; i++) {
      result.push([arr1[i], arr2[i]]);
    }

    return result;
  }
  return (
    <div className="container">
      <div className="row">
        <div className="col-md-12 col-lg-6">
          <div className="mt-3">
            <label htmlFor="wordInput" className="form-label">
              Enter Word:
            </label>
            <div className="d-flex gap-2" style={{ whiteSpace: "nowrap" }}>
              <input
                type="text"
                className="form-control w-75"
                id="wordInput"
                value={inputWord}
                onChange={(e) => {
                  setInputWord(e.target.value);
                }}
                maxLength={10}
              />
              <button className="btn btn-primary me-2" onClick={handleAddWord}>
                Add Word
              </button>
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center my-3">
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
            <br />
            <label className="form-check-label me-2">
              <input
                type="checkbox"
                className="form-check-input"
                checked={vertical}
                onChange={() => setVertical(!vertical)}
              />
              Vertical
            </label>
            <br />
            <label className="form-check-label me-2">
              <input
                type="checkbox"
                className="form-check-input"
                checked={diagonalTopLeft}
                onChange={() => setDiagonalTopLeft(!diagonalTopLeft)}
              />
              Diagonal (Top-Left to Bottom-Right)
            </label>
            <br />
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

          <button
            className="btn btn-success"
            onClick={() => {
              setBoards([]);

              const d_array: string[][] = [];
              for (let i = 0; i < wordArray.length; i += 10) {
                d_array.push(wordArray.slice(i, i + 10));
              }

              setDividedArray((_) => {
                return d_array;
              });

              d_array.map((single_array, i) => {
                setBoards((prevBoards) => {
                  return [...prevBoards, generatePuzzleForWords(single_array)];
                });
              });
            }}
          >
            Generate Puzzles
          </button>
          {wordArray.length == 0 ? (
            ""
          ) : (
            <div className="mt-3">
              <h5>Word List:</h5>
              <ul>
                {wordArray.map((word, index) => (
                  <>
                    <div className="d-flex justify-content-between">
                      <li key={index}>{word}</li>
                      <button
                        className="my-1 bg-white border-0"
                        onClick={() => handleDelete(index)}
                      >
                        <MdDelete className="text-danger fs-4" />
                      </button>
                    </div>
                  </>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="col-md-12 col-lg-6">
          <div className="row">
            {boards.length !== 0 ? (
              <div className="col-md-1 col-lg-1 col-1 position-relative">
                <button
                  className="carousel-control-prev"
                  type="button"
                  data-bs-target="#carouselExampleFade"
                  data-bs-slide="prev"
                  style={{ left: "17px", bottom: "30%" }}
                >
                  <span
                    className="carousel-control-prev-icon bg-black z-1 p-3"
                    aria-hidden="true"
                  ></span>

                  <span className="visually-hidden">Previous</span>
                </button>
              </div>
            ) : (
              ""
            )}

            <div className="col-md-10 col-lg-10 col-10">
              <div id={`wordsearch`}>
                <div
                  id="carouselExampleFade"
                  className="carousel slide carousel-fade"
                >
                  <div className="carousel-inner">
                    {zip(boards, dividedArray).map(
                      ([single_board, single_array], single_board_index) => {
                        return (
                          <div
                            key={single_board_index}
                            className={`carousel-item ${
                              single_board_index == 0 ? "active" : ""
                            }`}
                          >
                            <SinglePuzzle
                              board={single_board}
                              words_array={single_array}
                              board_index={single_board_index}
                              key={single_board_index}
                            />
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </div>
            {boards.length !== 0 ? (
              <div className="col-md-1 col-lg-1 col-1 position-relative">
                <button
                  className="carousel-control-next"
                  type="button"
                  data-bs-target="#carouselExampleFade"
                  data-bs-slide="next"
                  style={{ right: "17px", bottom: "29%" }}
                >
                  <span
                    className="carousel-control-next-icon bg-black z-1 p-3"
                    aria-hidden="true"
                  ></span>
                  <span className="visually-hidden">Next</span>
                </button>
              </div>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordSearch1;

interface SinglePuzzleProp {
  board: string[][];
  words_array: string[];
  board_index: number;
}
const SinglePuzzle: React.FC<SinglePuzzleProp> = ({
  board,
  words_array,
  board_index,
}) => {
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const downloadPDF = (id: number) => {
    const componentRef = document.getElementById(
      `wordsearch_${id}`
    ) as HTMLElement;

    html2canvas(componentRef).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 150;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.text(`WordSearch ${id + 1}`, 30, 10);

      pdf.addImage(imgData, "PNG", 30, 15, imgWidth, imgHeight);
      pdf.save(`WordSearch ${id + 1}.pdf`);
    });
  };

  return (
    <>
      <div id={`wordsearch_${board_index}`}>
        <table className="table text-center w-100 table-bordered border-dark border-4 mt-3">
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
                      }}
                    >
                      <span
                        style={{
                          background:
                            parsedCell?.orignalLetter && showSolution
                              ? "antiquewhite"
                              : "white",
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
        <div className="mt-3">
          <h5 className="text-center py-2">Puzzle Words</h5>
          <div className="d-flex flex-wrap justify-content-start gap-3">
            {words_array.map((word, index) => (
              <>
                <li className="list-unstyled" key={index}>
                  {word}
                </li>
              </>
            ))}
          </div>
        </div>
      </div>

      <button
        className="btn btn-dark my-3"
        onClick={() => setShowSolution(!showSolution)}
      >
        {showSolution ? `Hide` : `Show`} Solution
      </button>

      <button
        className="btn btn-primary mx-1 my-3"
        onClick={() => downloadPDF(board_index)}
      >
        Download
      </button>
    </>
  );
};
