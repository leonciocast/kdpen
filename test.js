function calculateGridSize(wordsToFind) {
  const maxWordLength = Math.max(...wordsToFind.map((word) => word.length));
  const bufferSpacePerWord = 1;
  const totalBufferSpace = bufferSpacePerWord * wordsToFind.length;
  let size = maxWordLength + totalBufferSpace;
  const minSize = Math.min(...wordsToFind.map((word) => word.length));
  size = Math.max(size, minSize);
  return size;
}

function generateWordSearch(words) {
  const uniqueWords = [...new Set(words)];
  const size = calculateGridSize(uniqueWords);
  const cols = size;
  const rows = size;

  // Initialize an empty grid
  const grid = Array.from({ length: rows }, () => Array(cols).fill(" "));

  // Place words in the grid
  for (const word of uniqueWords) {
    const directionOptions = [
      "horizontal",
      "vertical",
      "diagonalDown",
      "diagonalUp",
      "verticalUp",
      "horizontalBackward",
    ];
    const direction =
      directionOptions[Math.floor(Math.random() * directionOptions.length)];
    let placed = false;

    while (!placed) {
      if (direction === "horizontal") {
        const startRow = Math.floor(Math.random() * rows);
        const startCol = Math.floor(Math.random() * (cols - word.length + 1));

        if (
          Array.from({ length: word.length }).every(
            (_, i) =>
              grid[startRow][startCol + i] === " " ||
              grid[startRow][startCol + i] === word[i]
          )
        ) {
          for (let i = 0; i < word.length; i++) {
            grid[startRow][startCol + i] = word[i];
          }
          placed = true;
        }
      } else if (direction === "vertical") {
        const startRow = Math.floor(Math.random() * (rows - word.length + 1));
        const startCol = Math.floor(Math.random() * cols);

        if (
          Array.from({ length: word.length }).every(
            (_, i) =>
              grid[startRow + i][startCol] === " " ||
              grid[startRow + i][startCol] === word[i]
          )
        ) {
          for (let i = 0; i < word.length; i++) {
            grid[startRow + i][startCol] = word[i];
          }
          placed = true;
        }
      } else if (direction === "diagonalDown") {
        const startRow = Math.floor(Math.random() * (rows - word.length + 1));
        const startCol = Math.floor(Math.random() * (cols - word.length + 1));

        if (
          Array.from({ length: word.length }).every(
            (_, i) =>
              grid[startRow + i][startCol + i] === " " ||
              grid[startRow + i][startCol + i] === word[i]
          )
        ) {
          for (let i = 0; i < word.length; i++) {
            grid[startRow + i][startCol + i] = word[i];
          }
          placed = true;
        }
      } else if (direction === "diagonalUp") {
        const startRow =
          Math.floor(Math.random() * (rows - word.length)) + word.length - 1;
        const startCol = Math.floor(Math.random() * (cols - word.length + 1));

        if (
          Array.from({ length: word.length }).every(
            (_, i) =>
              grid[startRow - i][startCol + i] === " " ||
              grid[startRow - i][startCol + i] === word[i]
          )
        ) {
          for (let i = 0; i < word.length; i++) {
            grid[startRow - i][startCol + i] = word[i];
          }
          placed = true;
        }
      } else if (direction === "verticalUp") {
        const startRow =
          Math.floor(Math.random() * (rows - word.length)) + word.length - 1;
        const startCol = Math.floor(Math.random() * cols);

        if (
          Array.from({ length: word.length }).every(
            (_, i) =>
              grid[startRow - i][startCol] === " " ||
              grid[startRow - i][startCol] === word[i]
          )
        ) {
          for (let i = 0; i < word.length; i++) {
            grid[startRow - i][startCol] = word[i];
          }
          placed = true;
        }
      } else if (direction === "horizontalBackward") {
        const startRow = Math.floor(Math.random() * rows);
        const startCol =
          Math.floor(Math.random() * (cols - word.length)) + word.length - 1;

        if (
          Array.from({ length: word.length }).every(
            (_, i) =>
              grid[startRow][startCol - i] === " " ||
              grid[startRow][startCol - i] === word[i]
          )
        ) {
          for (let i = 0; i < word.length; i++) {
            grid[startRow][startCol - i] = word[i];
          }
          placed = true;
        }
      }
    }
  }

  // Fill the remaining empty spaces with random letters
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (grid[i][j] === " ") {
        grid[i][j] = String.fromCharCode(Math.floor(Math.random() * 26) + 65);
      }
    }
  }

  return grid;
}

function printWordSearch(grid) {
  for (const row of grid) {
    console.log(row.join(" "));
  }
}

// Example usage:
const wordsToFind = [
  "PYTHON",
  "JAVA",
  "C++",
  "HTML",
  "CSS",
  "RUST",
  "PHP",
  "GOLANG",
  "RUBY",
  "PYTHON",
  "JAVA",
  "C++",
  "HTML",
  "CSS",
  "RUST",
  "PHP",
  "GOLANG",
  "RUBY",
];

// let i = 1;

// while (true) {
//   console.log(i);
//   const wordSearchGrid = generateWordSearch(wordsToFind);
//   printWordSearch(wordSearchGrid);

//   i++;
// }
let grid = generateWordSearch(wordsToFind);

console.log(grid)