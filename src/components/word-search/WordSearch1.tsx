"use client";
import React, { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import CSVReader from "react-csv-reader";
import { MdDelete } from "react-icons/md";
import { BsPrinter } from "react-icons/bs";

interface Orientation {
  dx: number;
  dy: number;
}

const WordSearch1: React.FC = () => {
  const [horizontal, setHorizontal] = useState<boolean>(true);
  const [vertical, setVertical] = useState<boolean>(true);
  const [diagonalTopLeft, setDiagonalTopLeft] = useState<boolean>(true);
  const [diagonalBottomLeft, setDiagonalBottomLeft] = useState<boolean>(true);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [inputWords, setInputWords] = useState<string>("");
  const [uniqueWords, setUniqueWords] = useState<Set<string>>(new Set());
  const [boards, setBoards] = useState<string[][][]>([]);
  const [wordArray, setWordArray] = useState<string[]>([]);
  const [dividedArray, setDividedArray] = useState<string[][]>([]);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const handleDownloadClick = () => {
    const uploadedFilePath = '/assets/wordsearch.csv';
    window.open(uploadedFilePath);
  };


  const printAllPuzzles = async () => {
    setIsPrinting(true);
    const canvasList: HTMLCanvasElement[] = [];

    const carousel = document.getElementById("carouselExampleFade");

    if (carousel) {
      // Temporarily show all carousel items
      const carouselItems = carousel.querySelectorAll(".abc");
      carouselItems.forEach((item) => item.classList.add("active"));

      // Wait for the carousel to update
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture canvases for all carousel items
      const componentRefs = carousel.querySelectorAll(
        ".single-puzzle-component"
      ) as NodeListOf<HTMLElement>;
      for (let i = 0; i < componentRefs.length; i++) {
        const componentRef = componentRefs[i];
        try {
          const canvas = await html2canvas(componentRef, {
            useCORS: true,
            scale: 2,
          });
          canvasList.push(canvas);
        } catch (error) {
          console.error("Error rendering canvas:", error);
          setIsPrinting(false);
          return;
        }
      }

      // Restore the original state of carousel items

      for (let j = 0; j < carouselItems.length; j++) {
        if (j === 0) {
          carouselItems[j].classList.add("active");
        } else {
          carouselItems[j].classList.remove("active");
        }
      }
    }

    // Print all captured canvases
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(
        "<html><head><title>All Word Search Puzzles</title></head><body>"
      );
      for (let i = 0; i < canvasList.length; i++) {
        printWindow.document.write('<div style="page-break-before: always;">');
        printWindow.document.write(
          `<h4 style="text-align: center;">Word Search Puzzle: ${i + 1}</h4>`
        );
        printWindow.document.write(
          `<img src="${canvasList[i].toDataURL(
            "image/png"
          )}" style="width: 80%; display:flex;margin:auto" />`
        );
        printWindow.document.write("</div>");
      }
      printWindow.document.write("</body></html>");
      printWindow.document.close();
      printWindow.print();
    } else {
      console.error("Failed to open print window");
    }

    setIsPrinting(false);
  };

  const getRandomInt = (max: number): number => {
    return Math.floor(Math.random() * Math.floor(max));
  };
  const getRandomColor = () => {
    // Generate light shade colors by ensuring higher values for RGB components
    const r = Math.floor(Math.random() * 100) + 155; // Red component
    const g = Math.floor(Math.random() * 100) + 155; // Green component
    const b = Math.floor(Math.random() * 100) + 155; // Blue component

    // Convert RGB components to hexadecimal format and concatenate
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
  };

  const placeWord = (
    board: string[][],
    word: string,
    directions: Orientation[]
  ): string[][] => {
    let placed = false;

    const r_color = getRandomColor();

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
              color: r_color,
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
          });
        }
      }
    }

    return board;
  };

  const addUniqueWords = (newWords: string[]) => {
    const updatedSet = new Set(uniqueWords);
    newWords.forEach((word) => updatedSet.add(word));
    setUniqueWords(updatedSet);
  };

  const handleAddWord = (): void => {
    if (inputWords.trim() !== "") {
      const newWords = inputWords.split("\n").map((word) => word.trim().toUpperCase());
      const duplicateWords = newWords.filter((word) => uniqueWords.has(word));
  
      if (duplicateWords.length > 0) {
        const duplicateWordMessage = duplicateWords.map((word) => `"${word}"`).join(", ");
        alert(`The word(s) ${duplicateWordMessage} already exist(s).`);
        return;
      }
  
      setWordArray((prevWordArray) => [...prevWordArray, ...newWords]);
      newWords.forEach((word) => uniqueWords.add(word));
      setInputWords("");
      alert(`Word(s) "${newWords.join(', ')}" added successfully!`);
    } else {
      alert("Please enter words before adding.");
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
  const generateAllPuzzlesPDF = () => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    boards.forEach((_, index) => {
      const componentRef = document.getElementById(
        `wordsearch_${index}`
      ) as HTMLElement;
      if (!componentRef || !componentRef.innerHTML.trim()) {
        return;
      }
      console.log(componentRef);
      const dpi = 400;
      html2canvas(componentRef, { scale: dpi / 156 }).then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = 150;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        if (index !== 0) {
          pdf.addPage();
        }
        pdf.text(`WordSearch ${index + 1}`, 30, 20);
        pdf.addImage(imgData, "PNG", 30, 30, imgWidth, imgHeight);
        if (index === boards.length - 1) {
          pdf.save(`WordSearchAll.pdf`);
        }
      });
    });
  };

  const handleFileUpload = (data: string[][]): void => {
    let wordsFromFile = data.map((item) => item[0].trim());
    wordsFromFile = wordsFromFile.map((word) => {
      return word.toUpperCase().trim();
    });
    const uniqueWordsFromFile = wordsFromFile.filter((word, index, self) => {
      return index === self.indexOf(word);
    });
  
    setWordArray([...wordArray, ...uniqueWordsFromFile]);
    addUniqueWords(uniqueWordsFromFile); 
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
              Enter Words:
            </label>
            <div className="d-flex gap-2" style={{ whiteSpace: "nowrap" }}>
              <textarea
                placeholder="when multiple words (separated by new line)"
                className="form-control w-75"
                id="wordInput"
                value={inputWords}
                maxLength={10}
                onChange={(e) => {
                  setInputWords(e.target.value);
                }}
                rows={3}
              />
            </div>
            <button
              className="btn btn-primary me-2 mt-2"
              onClick={handleAddWord}
            >
              Add Word
            </button>
          <button id="downloadButton" className="btn btn-success me-2 mt-2" onClick={handleDownloadClick}>Download CSV File</button>

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

              d_array.map((single_array) => {
                setBoards((prevBoards) => {
                  return [...prevBoards, generatePuzzleForWords(single_array)];
                });
              });
            }}
          >
            Generate Puzzles
          </button>

          <button
            className="btn btn-dark mx-2 my-3"
            onClick={() => setShowSolution(!showSolution)}
          >
            {showSolution ? `Hide` : `Show`} Solution
          </button>
          <button
            className="btn btn-primary mx-1 my-3"
            onClick={generateAllPuzzlesPDF}
          >
            Download (PDF)
          </button>
          <button
            className="btn btn-info text-white mx-1 my-2 text-nowrap"
            onClick={printAllPuzzles}
            disabled={isPrinting}
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
          {wordArray.length == 0 ? (
            ""
          ) : (
            <div className="mt-3">
              <h5>Word List:</h5>
              <ol>
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
              </ol>
            </div>
          )}
        </div>
        <div className="col-md-12 col-lg-6 position-fixed start-50">
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
              <div>
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
                            className={`carousel-item abc d-block ${single_board_index === 0 ? "active" : ""
                              }`}
                          >
                            <SinglePuzzle
                              board={single_board}
                              words_array={single_array}
                              board_index={single_board_index}
                              key={single_board_index}
                              showSolution={showSolution}
                              boards={boards}
                              className="single-puzzle-component" // Add this class name
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
  showSolution: boolean;
  boards: string[][][];
  className?: string;
}
const SinglePuzzle: React.FC<SinglePuzzleProp> = ({
  board,
  words_array,
  board_index,
  showSolution,
  className,
  boards,
}) => {
  return (
    <>
      <div id={`wordsearch_${board_index}`} className={className}>
        <table className="table text-center w-100 table-bordered border-dark border-2 mt-3">
          <tbody style={{ border: "black 3px solid" }}>
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
                        className="rounded"
                        style={{
                          background:
                            parsedCell?.orignalLetter && showSolution
                              ? parsedCell?.color
                              : "white",
                          padding: "4px 6px", // Adjust padding as needed
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
    </>
  );
};
