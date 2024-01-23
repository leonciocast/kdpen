'use client';
/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
// import React from "react";

import React, { useEffect, useMemo, useState } from "react";
import { AlgorithmType, CWG, CellPropsType } from "./utils";
import html2canvas from 'html2canvas';
import { jsPDF } from "jspdf";
// import CWG from "cwg";



// const initWords = [
//   {
//     word: "AJAX",
//     clue: "A way to make request to server without loading page",
//   },
//   { word: "REACT", clue: "Popular UI liabrary of JS" },
//   { word: "DJANGO", clue: "A framework for perfectionists with deadlines" },
// ];
const CrossWordGenerator: React.FC = () => {
  const initWords = [
    "AJAX",
    "ASBESTOS",
    "TORSION",
    "TWERK",
    "PUNCH",
    "WILLOW",
    "PRACTICALJOKE",
    "PREFAB",
    "QATAR",
    "PUSSY",
    "ANIMATE",
    "COLORADO",
    "MEWS",
    "ANTIPOPE",
    "APRON",
    "MISHIT",
    "SANDWICHBOARD",
    "EXTOL",
    "TREMOLO",
  ];
  const [showSolution, setSolution] = useState(false);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>({
    positionObjArr: [],
    width: 0,
    height: 0,
    ownerMap: [],
  });
  // const [inputWords, setInputWords] = useState<WordClueType[]>(initWords);
  // const words: string[] = useMemo(() => {
  //   return inputWords.map(elm => elm.word);;
  // }, [inputWords]);
  const words: string[] = initWords;

  const wordsWithIndex = useMemo(() => {
    return algorithm?.positionObjArr.map((item, index) => ({
      ...item,
      index,
    }));
  }, [algorithm]);

  const generateNewPuzzle = () => {
    // const w = ["do", "not"];
    const result = CWG(words);
    if (result) {
      setAlgorithm(result);
    } else {
      setAlgorithm({
        positionObjArr: [],
        width: 0,
        height: 0,
        ownerMap: [],
      });
    }
    console.log("Result", result);
  };

  useEffect(() => {
    generateNewPuzzle();
  }, []);
  console.log("Algorithm: ", algorithm);
  console.log(
    "here are the input words",
    initWords,
    "here are the memo words",
    words
  );

  console.log("Words with index", wordsWithIndex);

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
            // visibility: cell?.letter ? "visible" : "hidden",
            color: "black",
            // background: cell?.letter ? "white" : "black",
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
        if (ownerCell) {
          rowContent.push(
            <Cell key={`${row}-${col}`} cell={ownerCell} row={row} col={col} />
          );
        } else {
          rowContent.push(
            <Cell key={`${row}-${col}`} cell={ownerCell} row={row} col={col} />
          );
          // const intersectingPoint = positionObjArr.find(
          //   (pos) => pos.xNum === col && pos.yNum === row
          // );
          // if (intersectingPoint) {
          //   rowContent.push(
          //     <Cell
          //       key={`${row}-${col}`}
          //       cell={ownerCell}
          //       row={row}
          //       col={col}
          //     />
          //   );
          // } else {
          //   // Display an empty cell
          //   rowContent.push(
          //     <Cell
          //       key={`${row}-${col}`}
          //       cell={ownerCell}
          //       row={row}
          //       col={col}
          //     />
          //   );
          // }
        }
      }
      grid.push(<tr key={row}>{rowContent}</tr>);
    }

    return grid;
  };

  function findWordIndex(col: number, row: number) {
    for (let i = 0; i < algorithm.positionObjArr.length; i++) {
      const word = algorithm.positionObjArr[i];
      if (word.xNum === col && word.yNum === row) {
        return i; // Return the index if a match is found
      }
    }
    return -1; // Return -1 if no match is found
  }

  const downloadPDF = () => {
    const componentRef = document.getElementById(`crossword`) as HTMLElement;

    html2canvas(componentRef).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF ({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',

        });

        const imgWidth = 300;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        // pdf.text(`crossword`,0,0)

        pdf.addImage(imgData, 'PNG', 50,10, imgWidth, imgHeight);
        pdf.save(`crossword.pdf`);
    });
};

  // .filter((obj) => obj.isHorizon))

  return (
    <div className="crossword-grid">
      <div className="container">
        <div className="row">
          <div className="d-flex my-3">
            <button
              type="button"
              className="btn btn-primary me-3"
              onClick={generateNewPuzzle}
            >
              Regenerate
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSolution(!showSolution)}
            >
              Show Solution
            </button>
            <button className="btn btn-primary mx-1" onClick={() => downloadPDF()}>Download</button>
          </div>
        </div>

        <div id={`crossword`}>
        <div className="row">
          <div className="col-6">
            <table
              style={
                {
                  // border: "1px solid black",
                  // padding: "20px",
                }
              }
            >
              <tbody>{renderGrid()}</tbody>
            </table>
          </div>
        </div>
        <div className="row">
          <div className="col-6">
            <div className="d-flex">
              <ul>
                <b>Across</b>
                {wordsWithIndex
                  .filter((obj) => obj?.isHorizon)
                  .map((word, index) => {
                    return (
                      <li key={index}>
                        {word.index} {word.wordStr}
                      </li>
                    );
                  })}
              </ul>
              <ul>
                <b>Down</b>
                {wordsWithIndex
                  .filter((obj) => !obj?.isHorizon)
                  .map((word, index) => {
                    return (
                      <li key={index}>
                        {word.index} {word.wordStr}
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default CrossWordGenerator;
