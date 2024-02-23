"use client";
import React, { useEffect, useMemo, useState } from "react";
import { AlgorithmType, CWG, CellPropsType, PositionObjectType } from "./utils";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import CSVReader from "react-csv-reader";
import "bootstrap/dist/css/bootstrap.min.css";
import { MdDelete } from "react-icons/md";
import { BsArrowDownCircle,BsArrowRepeat,BsEye, BsEyeSlash,BsPrinter   } from "react-icons/bs";

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
  // const [words_per_puzzle, set_words_per_puzzle] = useState(10);
  const [puzzles, setPuzzles] = useState<AlgorithmType[]>([]);
  const [showSolution, setSolution] = useState(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadClick = () => {
    const uploadedFilePath = '/assets/crossword.csv';
    window.open(uploadedFilePath);
  };


  const uniqueWordsSet = new Set<string>();

  
  const addUniqueWord = (word: string, clue: string) => {
    if (!uniqueWordsSet.has(word.toUpperCase())) {
      uniqueWordsSet.add(word.toUpperCase());
      setWords((prev) => [...prev, { word: word.toUpperCase(), clue }]);
    }
  };

 
  const MAX_WORDS_LIMIT = 10; 

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    const words = value.trim().split(/\s+/);
    if (words.length <= MAX_WORDS_LIMIT) {
      setInputWord((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    } else {
      setInputWord((prevData) => ({
        ...prevData,
        [name]: words.slice(0, MAX_WORDS_LIMIT).join(' '), 
      }));
  
      alert(`Maximum ${MAX_WORDS_LIMIT} words allowed.`);
    }
  };
  
 const handleAddWord = () => {
  if (inputWord.word.trim() !== "" && inputWord.clue.trim() !== "") {
    const wordsArray = inputWord.word.trim().split('\n');
    const cluesArray = inputWord.clue.trim().split('\n');

    if (wordsArray.length !== cluesArray.length) {
      alert("Number of words and clues should match.");
      return;
    }

    let newWordsToAdd: SingleWordType[] = [];
    let addedWords = [];
    for (let i = 0; i < wordsArray.length; i++) {
      const word = wordsArray[i].trim();
      const clue = cluesArray[i].trim();
      if (word && clue) {
        if (!wordExists(word.toUpperCase())) {
          uniqueWordsSet.add(word.toUpperCase());
          newWordsToAdd.push({ word: word.toUpperCase(), clue });
          addedWords.push(word);
        } else {
          alert("Word already exists: " + word);
        }
      }
    }

    if (newWordsToAdd.length > 0) {
      console.log("Current Words State:", words);
      setWords((prev) => [ ...prev, ...newWordsToAdd]); 
      // console.log("Updated Words State:", words);
      const updatedPuzzles = dividedArray.map((single_array) => generateNewPuzzle(single_array));
      setPuzzles(updatedPuzzles);
    }

    setInputWord(initialEmptyInput);
  } else {
    alert("Enter Word(s) and Clue(s) Both");
  }
};

  
  
  const wordExists = (word: any) => {
    return words.some(item => item.word.toUpperCase() === word);
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
    return result;
  };

  const handleCSVFile = (data: any, fileInfo: any) => {
    const newWords = data.map((item: any) => ({
      word: item[0].toUpperCase().trim(),
      clue: item[1].trim(),
    }));

    const addedWords: SingleWordType[] = [];

    newWords.forEach((wordObj: any) => {
      if (!wordExists(wordObj.word)) {
        uniqueWordsSet.add(wordObj.word);
        addedWords.push(wordObj);
      } else {
        alert("Word already exists: " + wordObj.word);
      }
    });

    if (addedWords.length > 0) {
      setWords((prevWords) => [...prevWords, ...addedWords]);
      // console.log("Words added successfully from CSV: " + addedWords.map(word => word.word).join(", "));
    }
  };


const handleDeleteWord = (index: number) => {
    const deletedWord = words[index];
    const newWords = words.filter((_, i) => i !== index);
    setWords(newWords);
  
   
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
    handleRegenerate();
  };  

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

  const printAllPuzzles = async () => {
    setIsPrinting(true); 
  
    const canvasList: HTMLCanvasElement[] = [];
  
    const carousel = document.getElementById("carouselExampleFade");
  
    let carouselItems: NodeListOf<Element>;
  
    if (carousel) {
      carouselItems = carousel.querySelectorAll(".carousel-item");
      for (let i = 0; i < carouselItems.length; i++) {
        const carouselItem = carouselItems[i];      
        carouselItem.classList.add("active");
        await new Promise((resolve) => setTimeout(resolve, 100));
        const componentRef = carouselItem.querySelector(".single-puzzle-component") as HTMLElement;
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
        carouselItem.classList.remove("active");
      }
    } else {
      console.error("Carousel not found");
      setIsPrinting(false);
      return;
    }
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(
        '<html><head><title>All Word Search Puzzles</title></head><body>'
      );
      for (let i = 0; i < canvasList.length; i++) {
        printWindow.document.write('<div style="page-break-before: always;">');
        printWindow.document.write(
          `<h2 style="text-align: center;">Word Search Puzzle: ${i + 1}</h2>`
        );
        printWindow.document.write(
          `<img src="${canvasList[i].toDataURL(
            "image/png"
          )}" style=" display:flex; justify-content:center; margin-left:auto; margin-right: auto;" />`
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
    if (carouselItems) {
      const lastCarouselItem = carouselItems[carouselItems.length - 1];
      lastCarouselItem.classList.add("active");
    }
  };
  
  
  const generateAllPuzzlesPDF = () => {
    setIsDownloading(true)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
  
    puzzles.forEach((_, index) => {
      const componentRef = document.getElementById(`wordsearch`) as HTMLElement;
      if (!componentRef || !componentRef.innerHTML.trim()) {
        console.error("Component reference not found or empty.");
        setIsDownloading(false);
        return;
      }
  
      html2canvas(componentRef, { scale: 9 }).then((canvas) => {
        try {
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = 230;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
          if (index !== 0) {
            pdf.addPage();
          }
          
          pdf.text(`WordSearch ${index + 1}`, 30, 20);
          pdf.addImage(imgData, "PNG", 30, 30, imgWidth, imgHeight);
  
          if (index === puzzles.length - 1) {
            pdf.save(`WordSearchAll.pdf`);
            setIsDownloading(false); 

          }
        } catch (error) {
          setIsDownloading(false)
          console.error("Error adding image to PDF:", error);
        }
      }).catch((error) => {
        setIsDownloading(false)
        console.error("Error generating canvas:", error);
      });
    });
  };

  return (
    <div className="crossword-grid mainWrapper">
      <div className="">
        <div className="row ">
          <div className="col-md-4 col-lg-5">
            <div className="row">
              <div className=" my-3 ">
                <form>
                  <div>
                    <textarea
                      className="form-control me-2 mb-2 w-100"
                      placeholder="Enter Word(s) (separated by newline) e.g: Lion"
                      value={inputWord.word}
                      name="word"
                      onChange={handleInputChange}
                      rows={3}
                      maxLength={10}
                    />
                    <textarea
                      className="form-control w-100"
                      placeholder="Enter Clue(s) (separated by newline) e.g: king of forest"
                      value={inputWord.clue}
                      name="clue"
                      onChange={handleInputChange}
                      rows={3}
                      maxLength={25}
                    />
                  </div>
                  <div className="mt-2 d-flex gap-2">
                    <button
                      type="button"
                      style={{fontSize:"14px"}}
                      disabled={isPrinting || isDownloading}
                      className="btn btn-primary text-nowrap"
                      onClick={handleAddWord}
                    >
                      Add Word
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      style={{fontSize:"14px"}}
                      disabled={isPrinting || isDownloading}
                      onClick={() => {
                        handleRegenerate();
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "5px",
                          alignItems: "center",
                        }}
                      >
                        <BsArrowRepeat />
                        <span> Regenerate </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="btn btn-dark text-nowrap"
                      style={{fontSize:"14px"}}
                      disabled={isPrinting || isDownloading}
                      onClick={() => setSolution(!showSolution)}
                    >
                      {showSolution ? (
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
                      className="btn btn-success text-white text-nowrap"
                      style={{fontSize:"14px"}}
                      onClick={printAllPuzzles}
                      disabled={isPrinting || isDownloading}
                    >
                      {isPrinting ? (
                        <div className="spinner-border spinner-border-sm me-2" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      ) : null}
                      <BsPrinter />
                      <span className="ms-1"> Print </span>
                    </button>
                      <button
                      type="button"
                      className="btn btn-primary text-nowrap"
                      style={{fontSize:"14px",display:"flex"}}
                      onClick={generateAllPuzzlesPDF}
                      disabled={isPrinting || isDownloading}                    
                    >{isDownloading?(
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    ):null}
                      <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
                        {/* <BsArrowDownCircle /> */}
                        <span> Download PDF</span>
                      </div>
                    </button>
                  </div>
                </form>

                <div className="mt-2 d-flex justify-content-between">
                  <CSVReader
                    disabled={isPrinting || isDownloading}
                    onFileLoaded={handleCSVFile}
                    parserOptions={{ header: false, skipEmptyLines: true }}
                  />
                  <button   style={{fontSize:"14px",display:"flex"}} className="btn btn-primary" id="downloadButton" onClick={handleDownloadClick}>Download CSV</button>
                </div>

              </div>
            </div>
              <div className="mt-3">
            {words.length > 0 && (

                <h5>Word List:</h5>
                  )} 
                {/* <ul>
                  {words.map((word, index) => (
                  <li key={index}>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex">
                      <div className="d-flex gap-5">
                        <p>{index} - {word.word}</p>
                        <p>{index} - {word.clue}</p>
                      </div>
                    </div>
                    <div>
                      <button
                        className="btn btn-link text-danger ms-3" // Adjust margin here for spacing
                        onClick={() => handleDeleteWord(index)}
                      >
                        <MdDelete className="fs-4" />
                      </button>
                    </div>
                  </div>
                </li>
                
                  ))}
                </ul> */}
               {words.length > 0 && (
  <div className="mb-4 overflow-y-scroll" style={{ height: '300px'}}>
    <table className="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Word</th>
          <th>Clue</th>
          <th>Delete</th>
        </tr>
      </thead>
      <tbody>
        {words.map((word, index) => (
          <tr key={index}>
            <td>{index}</td>
            <td>{word.word}</td>
            <td>{word.clue}</td>
            <td>
              <button
                className="btn btn-link text-danger"
                onClick={() => handleDeleteWord(index)}
              >
                <MdDelete className="fs-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
      
    </table>
  </div>
)}

              </div>          
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
                    data-bs-target="#carouselExampleFade"
                    data-bs-slide="prev"
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
                   id="carouselExampleFade" className="carousel slide carousel-fade"
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
                          className="single-puzzle-component"
                          showSolution={showSolution}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {/* <button
                    className="btn btn-primary mx-1 my-2 text-nowrap"
                    onClick={printAllPuzzles}
                    disabled={isPrinting}
                  >
                    {isPrinting ? (
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    ) : null}
                    <BsPrinter />
                    <span className="ms-1"> Print </span>
                  </button> */}
              </div>
              <div className="col-md-1 position-relative">
                {puzzles.length > 0 && (
                  <button
                    id="nextButton"
                    className="carousel-control-next"
                    style={{ right: "17px", bottom: "29%" }}
                    type="button"
                    data-bs-target="#carouselExampleFade"
                  data-bs-slide="next"
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
  showSolution: boolean;
  className?: string;
}
const SinglePuzzle: React.FC<SinglePuzzleType> = ({
  algorithm,
  orignal_words,
  board_index,
  showSolution,
  className,
}) => {
  

  const wordsWithIndex = useMemo(() => {
    return algorithm?.positionObjArr.map((item, index) => {
      return {
        ...item,
        index,
      };
    });
  }, [algorithm]);

  const renderCluesList = (isHorizon: boolean) => (
    <ul className="list-unstyled">
      <b>{isHorizon ? "Across" : "Down"}</b>
      {wordsWithIndex
        .filter((obj) => obj?.isHorizon === isHorizon)
        .map((word, index) => (
          <li key={index} style={{ whiteSpace: "nowrap" }}>
            <span>
              {word.index} - {getClueFromWord(word?.wordStr)}
            </span>
          </li>
        ))}
    </ul>
  );

  // const accrossWordsClues = useMemo(()=>{
  //   return wordsWithIndex
  //   .filter((obj) => obj?.isHorizon)
  // }, [wordsWithIndex])

  // const downWordsClues = useMemo(()=>{
  //   return wordsWithIndex
  //   .filter((obj) => !obj?.isHorizon)
  // }, [wordsWithIndex])


  // console.log("consoleLog",wordsWithIndex, accrossWordsClues, downWordsClues)


  function getClueFromWord(word: string) {
    const matchingEntry = orignal_words.find(
      (entry) => entry.word.toUpperCase() == word.toUpperCase()
      
      );
      // console.log("Input Word : ", word,matchingEntry,"matchingEntry")

    return matchingEntry ? matchingEntry.clue : null;
  }
  function findWordIndices(col: number, row: number) {
    const indices = [];
    for (let i = 0; i < algorithm.positionObjArr.length; i++) {
      const word = algorithm.positionObjArr[i];
      if (word.xNum === col && word.yNum === row) {
        indices.push(i);
      }
    }
    return indices;
  }

  const Cell: React.FC<CellPropsType> = ({ row, col, cell }) => {
    const indices = findWordIndices(col, row);

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

        {indices.map((index, idx) => (
          <div
            key={`${row}-${col}-${idx}`}
            style={{
              fontSize: "0.43rem",
              fontWeight:"bold",
              position: "absolute",
              left: 1 + idx * 19,
              top:-1.6,
              // top: 17 + idx * -2,
              color: "black",
              padding: "0",
            }}
          >
            {index}
          </div>
        ))}


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
     {showSolution ? cell?.letter.trim() : ""}
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
  // const downloadPDF = (id: number) => {
  //   const componentRef = document.getElementById(`crossword_${id}`) as HTMLElement;  
  //   // DPI (dots per inch) for better image quality
  //   const dpi = 400; 
  
  //   html2canvas(componentRef, { scale: dpi / 156 }) // Adjust scale based on DPI
  //     .then((canvas) => {
  //       const imgData = canvas.toDataURL("image/png");
  //       const pdf = new jsPDF({
  //         orientation: "portrait",
  //         unit: "mm",
  //         format: "a4",
  //       });
  
  //       const imgWidth = 150;
  //       const imgHeight = (canvas.height * imgWidth) / canvas.width;
  //       pdf.text(`Cross Word ${id + 1}`, 30, 10);
  
  //       pdf.addImage(imgData, "PNG", 30, 15, imgWidth, imgHeight);
  //       pdf.save(`crossword_${id + 1}.pdf`);
  //     });
  // };

  return (
    <>
      <div id={`wordsearch`}
        className={className}>
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
                          {word.index} -
                           {/* {word?.wordStr}   */}
                           {getClueFromWord(word?.wordStr)}
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
                        {word.index} - 
                        {/* {word?.wordStr} */}
                           {getClueFromWord(word?.wordStr)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* <button
        className="btn btn-primary mx-1 mt-2"
        onClick={() => downloadPDF(board_index)}
        
      >
      <div style={{display:"flex",gap:"5px",alignItems:"center"}}>  <BsArrowDownCircle /><span> Download </span>
      </div>
      </button> */}
    </>
  );
};
export default CrossWordGenerator;
