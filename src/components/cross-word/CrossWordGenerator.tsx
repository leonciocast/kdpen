"use client";
import React, { useEffect, useMemo, useState } from "react";
import { AlgorithmType, CWG, CellPropsType, PositionObjectType } from "./utils";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import CSVReader from "react-csv-reader";

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
  // const [buttonClicked, setButtonClicked] = useState(false);
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


  console.log("Divided Array:", dividedArray)
  const handleRegenerate = () => {
    setPuzzles([])
    dividedArray.map((single_array, single_array_index) => {
      setPuzzles((prevPuzzles) => {
        return [...prevPuzzles, generateNewPuzzle(single_array)];
      });
    });
  };

 

  const generateNewPuzzle = (input_words:SingleWordType[]) => {
    let words__ = input_words.filter(
      (word) => typeof word.word === "string" && word.word.trim() !== ""
    ).map((item) => item.word.trim());
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

  // useEffect(() => {
  //   generateNewPuzzle();
  // }, []);

  const handleCSVFile = (data: any, fileInfo: any) => {
    const newWords = data.map((item: any) => ({
      word: item[0].toUpperCase().trim(),
      clue: item[1],
    }));
    setWords((prevWords) => [...prevWords, ...newWords]);
  };

  // const dividedWords = useMemo(()=>{
  //   const wordsArrays: string[][] = [];
  //   for (let i = 0; i < words.length; i += 10) {
  //     wordsArrays.push(words.slice(i, i + 10));
  //   }
  //   return wordsArrays
  // }, [words])

  const downloadPDF = () => {
    const componentRef = document.getElementById(`crossword`) as HTMLElement;
    html2canvas(componentRef).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      html2canvas(componentRef, {
        scale: 2,
      }).then((canvas) => {});
      const imgWidth = 300;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 50, 10, imgWidth, imgHeight);
      pdf.save(`crossword.pdf`);
    });
  };

  console.log(
    "All Puzzles Algos: ", puzzles
  )

  return (
    <div className="crossword-grid">
      <div className="container">
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
                  className="form-control me-2 mb-2 w-50"
                  placeholder="Enter Clue"
                  value={inputWord.clue}
                  name="clue"
                  onChange={handleInputChange}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary me-2"
                onClick={handleAddWord}
              >
                Add Word
              </button>
              <button
                type="button"
                className="btn btn-primary me-2"
                onClick={() => {
                  handleRegenerate();
                }}
              >
                Regenerate
              </button>

              <button
                className="btn btn-primary mx-1 "
                onClick={() => downloadPDF()}
              >
                Download
              </button>
            </div>
            <div className="mt-2">
              <CSVReader
                onFileLoaded={handleCSVFile}
                parserOptions={{ header: false, skipEmptyLines: true }}
              />
            </div>
          </div>
        </div>
        {
          puzzles.map((single_algo, i)=>{
            return <SinglePuzzle key={i} algorithm={single_algo} orignal_words={words} />
          })
          }
      </div>
    </div>
  );
};

interface SinglePuzzleType {
  algorithm: AlgorithmType;
  orignal_words: SingleWordType[];
}
const SinglePuzzle: React.FC<SinglePuzzleType> = ({
  algorithm,
  orignal_words,
}) => {
  const [showSolution, setSolution] = useState(false);

  const wordsWithIndex = useMemo(() => {
    return algorithm?.positionObjArr.map((item, index) => ({
      ...item,
      index,
      clue: orignal_words[index]?.clue,
      wordStr: orignal_words[index]?.word,
    }));
  }, [algorithm, orignal_words]);

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

  return (
    <div id={`crossword`}>
      <div className="row">
        <div className="col-6">
          <table>
            <tbody>{renderGrid()}</tbody>
          </table>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setSolution(!showSolution)}
      >
        {showSolution ?  "Hide Solution" : "Show Solution"}
      </button>
      <div className="row">
        <div className="col-6">
          <div className="d-flex">
            <ul>
              <b>Across</b>
              {wordsWithIndex
                .filter((obj) => obj?.isHorizon)
                .map((word, index) => (
                  <li
                    key={index}
                    style={
                      word.index === 0
                        ? { listStyle: "none", whiteSpace: "nowrap" }
                        : { whiteSpace: "nowrap" }
                    }
                  >
                    {word.index === 0 ? (
                      ""
                    ) : (
                      <span>
                        {word.index} - {word?.clue}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
            <ul>
              <b>Down</b>
              {wordsWithIndex
                .filter((obj) => !obj?.isHorizon)
                .map((word, index) => (
                  <li key={index} style={{ whiteSpace: "nowrap" }}>
                    <span>
                      {word.index} - {word?.clue}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CrossWordGenerator;
