import { jsPDF } from 'jspdf';
import { PuzzleType } from './types/sudoku';

export const downloadPuzzlesAsPDF = (listOfPuzzles: PuzzleType[]) => {
    // Create a new instance of jsPDF
    const pdf = new jsPDF();

    // Iterate over each puzzle in the list
    listOfPuzzles.forEach((puzzle, puzzleIndex) => {
        // Add a new page for each puzzle (except the first one)
        if (puzzleIndex > 0) {
            pdf.addPage();
        }


        // Define the content for each page
        const content = puzzle.board.map((row) => row.join(' ')).join('\n');


        // // Add the content to the PDF
        pdf.text(content, 10, 10);
    });

    // Save the PDF file
    pdf.save('sudoku_puzzles.pdf');
};


