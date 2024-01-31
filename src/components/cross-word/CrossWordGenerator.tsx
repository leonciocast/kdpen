"use client";
import React, { useEffect, useMemo, useState } from "react";
import { AlgorithmType, CWG, CellPropsType, PositionObjectType } from "./utils";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import CSVReader from "react-csv-reader";
import "bootstrap/dist/css/bootstrap.min.css";
import { MdDelete } from "react-icons/md";

interface SingleWordType {
  word: string;
  clue: string;
}

const CrossWordGenerator: React.FC = () => {
  const initialEmptyInput = {
    word: "",
    clue: "",
  };
  const [inputWord, setInputWord] = useState<SingleWordType>(initialEmptyInput);
  const [words, setWords] = useState<SingleWordType[]>([]);
  const [words_per_puzzle, set_words_per_puzzle] = useState(10);
  const [puzzles, setPuzzles] = useState<AlgorithmType[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputWord((prevData) => ({
      ...prevData,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAddWord = () => {
    if (inputWord.word.trim() !== "" && inputWord.clue.trim() !== "") {
      setWords((prev) => [
        ...prev,
        {
          word: inputWord.word.toUpperCase().trim(),
          clue: inputWord.clue.trim(),
        },
      ]);
      setInputWord(initialEmptyInput);
    } else {
      alert("Enter Word and Clue Both");
    }
  };
  const dividedArray: SingleWordType[][] = useMemo(() => {
    const result = [];
    for (let i = 0; i < words.length; i += 10) {
      result.push(words.slice(i, i + 10));
    }
    return result;
  }, [words]);
  const handleRegenerate = () => {
    setPuzzles((prevPuzzles) => {
      const updatedPuzzles = dividedArray.map((single_array) =>
        generateNewPuzzle(single_array)
      );
      return updatedPuzzles;
    });
  };


  const generateNewPuzzle = (input_words: SingleWordType[]) => {
    let words__ = input_words
      .filter(
        (word) => typeof word.word === "string" && word.word.trim() !== ""
      )
      .map((item) => item.word.trim());
    let result = CWG(words__);
    if (!result) {
      result = {
        positionObjArr: [],
        width: 0,
        height: 0,
        ownerMap: [],
      };
    }

    // setAlgorithm(result);
    return result;
  };

  const handleCSVFile = (data: any, fileInfo: any) => {
    const newWords = data.map((item: any) => ({
      word: item[0].toUpperCase().trim(),
      clue: item[1],
    }));
    setWords((prevWords) => [...prevWords, ...newWords]);
  };
const handleDeleteWord = (index: number) => {
    const deletedWord = words[index];
    const newWords = words.filter((_, i) => i !== index);
    setWords(newWords);
  
    // Remove the deleted word from puzzles
    setPuzzles((prevPuzzles) =>
      prevPuzzles.map((puzzle) => {
        const updatedPositionObjArr = puzzle.positionObjArr.filter(
          (positionObj) => positionObj.wordStr !== deletedWord.word
        );
  
        return {
          ...puzzle,
          positionObjArr: updatedPositionObjArr,
        };
      })
    );
  
    // Regenerate puzzles after deleting a word
    handleRegenerate();
  };
  // const dividedWords = useMemo(()=>{
  //   const wordsArrays: string[][] = [];
  //   for (let i = 0; i < words.length; i += 10) {
  //     wordsArrays.push(words.slice(i, i + 10));
  //   }
  //   return wordsArrays
  // }, [words])
  

  const handlePrevButtonClick = () => {
    const carousel = document.getElementById("carouselExample");
    if (carousel) {
      carousel.setAttribute("data-bs-slide", "prev");
      const bsCarousel = new (window as any).bootstrap.Carousel(carousel);
      bsCarousel.to("prev");
    }
  };

  const handleNextButtonClick = () => {
    const carousel = document.getElementById("carouselExample");
    if (carousel) {
      carousel.setAttribute("data-bs-slide", "next");
      const bsCarousel = new (window as any).bootstrap.Carousel(carousel);
      bsCarousel.to("next");
    }
  };

  return (
    <div className="crossword-grid mainWrapper">
      <div className="">
        <div className="row ">
          <div className="col-md-4 col-lg-5">
            <div className="row">
              <div className=" my-3 ">
                <div>
                  <div>
                    <input
                      type="text"
                      className="form-control me-2 mb-2 w-50"
                      placeholder="Enter Word"
                      value={inputWord.word}
                      name="word"
                      onChange={handleInputChange}
                    />
                    <input
                      type="text"
                      className="form-control  w-50"
                      placeholder="Enter Clue"
                      value={inputWord.clue}
                      name="clue"
                      onChange={handleInputChange}
                    />
                  </div>
                  <div style={{ display: "flex" }}>
                    <button
                      type="button"
                      style={{
                        margin: "7px 5px",
                        padding: "3px 5px",
                        whiteSpace: "nowrap",
                      }}
                      className="btn btn-primary "
                      onClick={handleAddWord}
                    >
                      Add Word
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary "
                      style={{
                        margin: "7px 5px",
                        padding: "3px 5px",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => {
                        handleRegenerate();
                      }}
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <CSVReader
                    onFileLoaded={handleCSVFile}
                    parserOptions={{ header: false, skipEmptyLines: true }}
                  />
                </div>
              </div>
            </div>
            {puzzles.length > 0 &&  (
            
            <div className="mt-3">
              <h5>Word List:</h5>
              <ul >
                      {words.map((word, index) => (
                        
                        <li key={index} className="d-flex align-items-center justify-content-between">
                             <span>{index } - {word.word}</span>
                          <button
                            className="btn btn-link text-danger"
                            onClick={() => handleDeleteWord(index)}
                          >
                            <MdDelete className="fs-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
            </div>
          )}
          </div>
          <div className="col-md-8 col-lg-7">
            <div className="row my-3">
              <div className="col-md-1 position-relative">
                {puzzles.length > 0 && (
                  <button
                    id="prevButton"
                    className="carousel-control-prev"
                    style={{ left: "17px", bottom: "30%" }}
                    type="button"
                    onClick={handlePrevButtonClick}
                  >
                    <span
                      className="carousel-control-prev-icon bg-black z-1 p-3"
                      aria-hidden="true"
                    ></span>
                    <span className="visually-hidden">Previous</span>
                  </button>
                )}
              </div>
              <div className="col-md-10">
                <div
                  id="carouselExample"
                  className="carousel slide carousel-fade"
                >
                  <div className="carousel-inner">
                    {puzzles.map((single_algo, i) => (
                      <div
                        key={i}
                        className={`carousel-item ${i === 0 ? "active" : ""}`}
                      >
                        <SinglePuzzle
                          algorithm={single_algo}
                          orignal_words={words}
                          board_index={i}
                          key={i}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-1 position-relative">
                {puzzles.length > 0 && (
                  <button
                    id="nextButton"
                    className="carousel-control-next"
                    style={{ right: "17px", bottom: "29%" }}
                    type="button"
                    onClick={handleNextButtonClick}
                  >
                    <span
                      className="carousel-control-next-icon bg-black z-1 p-3"
                      aria-hidden="true"
                    ></span>
                    <span className="visually-hidden">Next</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SinglePuzzleType {
  algorithm: AlgorithmType;
  orignal_words: SingleWordType[];
  board_index: number;
}
const SinglePuzzle: React.FC<SinglePuzzleType> = ({
  algorithm,
  orignal_words,
  board_index,
}) => {
  const [showSolution, setSolution] = useState(true);

  const wordsWithIndex = useMemo(() => {
    return algorithm?.positionObjArr.map((item, index) => {
      return {
        ...item,
        index,
      };
    });
  }, [algorithm]);

  const accrossWordsClues = useMemo(()=>{
    return wordsWithIndex
    .filter((obj) => obj?.isHorizon)
  }, [wordsWithIndex])

  const downWordsClues = useMemo(()=>{
    return wordsWithIndex
    .filter((obj) => !obj?.isHorizon)
  }, [wordsWithIndex])


  console.log("consoleLog",wordsWithIndex, accrossWordsClues, downWordsClues)


  function getClueFromWord(word: string) {
    const matchingEntry = orignal_words.find(
      (entry) => entry.word.toUpperCase() == word.toUpperCase()
      
      );
      console.log("Input Word : ", word,matchingEntry,"matchingEntry")

    return matchingEntry ? matchingEntry.clue : null;
  }

  function findWordIndex(col: number, row: number) {
    for (let i = 0; i < algorithm.positionObjArr.length; i++) {
      const word = algorithm.positionObjArr[i];
      if (word.xNum === col && word.yNum === row) {
        return i;
      }
    }
    return -1;
  }

  const Cell: React.FC<CellPropsType> = ({ row, col, cell }) => {
    return (
      <td
        data-row={row}
        data-col={col}
        data-v={cell?.v}
        data-h={cell?.h}
        data-hidx={cell?.hIdx}
        data-vidx={cell?.vIdx}
        style={{
          position: "relative",
          border: "1px solid black",
          padding: 0,
        }}
      >
        {(cell?.vIdx === 0 || cell?.hIdx === 0) && (
          <div
            style={{
              fontSize: "0.43rem",
              position: "absolute",
              left: 1,
              top: 1,
              color: "black",
            }}
          >
            {findWordIndex(col, row)}
          </div>
        )}

        <div
          style={{
            width: "1.5rem",
            height: "1.5rem",
            fontSize: "1rem",
            textAlign: "center",
            padding: "0",
            background:
              cell?.vIdx === 0 || cell?.hIdx === 0
                ? "gainsboro"
                : cell?.vIdx || cell?.hIdx
                ? "white"
                : "gray",
            color: "black",
          }}
        >
          {showSolution ? cell?.letter : ""}
        </div>
      </td>
    );
  };

  const renderGrid = () => {
    const { height, width, positionObjArr, ownerMap } = algorithm;

    const grid = [];
    for (let row = 0; row < height; row++) {
      const rowContent = [];
      for (let col = 0; col < width; col++) {
        const ownerCell = ownerMap[row][col];
        rowContent.push(
          <Cell key={`${row}-${col}`} cell={ownerCell} row={row} col={col} />
        );
      }
      grid.push(<tr key={row}>{rowContent}</tr>);
    }

    return grid;
  };
  const downloadPDF = (id: number) => {
    const componentRef = document.getElementById(
      `crossword_${id}`
    ) as HTMLElement;

    html2canvas(componentRef).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 100;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.text(`Cross Word ${id + 1}`, 30, 10);

      pdf.addImage(imgData, "PNG", 30, 15, imgWidth, imgHeight);
      pdf.save(`crossword ${id + 1}.pdf`);
    });
  };

  return (
    <>
      <div id={`crossword_${board_index}`}>
        <div className="row">
          <div className="col-6">
            <table>
              <tbody>{renderGrid()}</tbody>
            </table>
          </div>
        </div>

        <div className="">
          <div className="">
            <div className="d-flex my-3 gap-4">
              {/* {JSON.stringify(algorithm, null, 2)} */}
              <ul className="list-unstyled">
                <b>Across</b>
                {wordsWithIndex
                  .filter((obj) => obj?.isHorizon)
                  .map((word, index) => (
                    <li key={index} 
                    style={ word.index === 0
                          ? { listStyle: "none", whiteSpace: "nowrap" }
                          : { whiteSpace: "nowrap" }
                      }
                    >
                      {word.index === 0 ? (
                        ""
                      ) : (
                        <span>
                          {word.index} - {word?.wordStr}  | {getClueFromWord(word?.wordStr)}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
              <ul className="list-unstyled">
                <b>Down</b>
                {wordsWithIndex
                  .filter((obj) => !obj?.isHorizon)
                  .map((word, index) => (
                    <li key={index} style={{ whiteSpace: "normal" }}>{/*no-wrap*/}
                      <span>
                        {word.index} - {word?.wordStr}  | {getClueFromWord(word?.wordStr)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary mt-2"
        onClick={() => setSolution(!showSolution)}
      >
        {showSolution ? "Hide Solution" : "Show Solution"}
      </button>
      <button
        className="btn btn-primary mx-1 mt-2"
        onClick={() => downloadPDF(board_index)}
        
      >
        Download
      </button>
    </>
  );
};
export default CrossWordGenerator;
