import random


def calculate_grid_size(words_to_find):
    max_word_length = max(len(word) for word in words_to_find)
    buffer_space_per_word = 1
    total_buffer_space = buffer_space_per_word * len(words_to_find)
    size = max_word_length + total_buffer_space
    min_size = len(min(words_to_find, key=len))
    size = max(size, min_size)
    return size


def generate_word_search(words):
    words = set(words)
    size = calculate_grid_size(words)
    cols = size
    rows = size
    # Initialize an empty grid
    grid = [[" " for _ in range(cols)] for _ in range(rows)]
    # Place words in the grid
    for word in words:
        direction = random.choice(
            [
                "horizontal",
                "vertical",
                "diagonalDown",
                "diagonalUp",
                "verticalUp",
                "horizontalBackward",
            ]
        )
        placed = False
        while not placed:
            if direction == "horizontal":
                start_row = random.randint(0, rows - 1)
                start_col = random.randint(0, cols - len(word))
                if all(
                    grid[start_row][start_col + i] == " "
                    or grid[start_row][start_col + i] == word[i]
                    for i in range(len(word))
                ):
                    for i in range(len(word)):
                        grid[start_row][start_col + i] = word[i]
                    placed = True
            elif direction == "vertical":
                start_row = random.randint(0, rows - len(word))
                start_col = random.randint(0, cols - 1)
                if all(
                    grid[start_row + i][start_col] == " "
                    or grid[start_row + i][start_col] == word[i]
                    for i in range(len(word))
                ):
                    for i in range(len(word)):
                        grid[start_row + i][start_col] = word[i]
                    placed = True
            elif direction == "diagonalDown":
                start_row = random.randint(0, rows - len(word))
                start_col = random.randint(0, cols - len(word))
                if all(
                    grid[start_row + i][start_col + i] == " "
                    or grid[start_row + i][start_col + i] == word[i]
                    for i in range(len(word))
                ):
                    for i in range(len(word)):
                        grid[start_row + i][start_col + i] = word[i]
                    placed = True
            elif direction == "diagonalUp":
                start_row = random.randint(len(word) - 1, rows - 1)
                start_col = random.randint(0, cols - len(word))
                if all(
                    grid[start_row - i][start_col + i] == " "
                    or grid[start_row - i][start_col + i] == word[i]
                    for i in range(len(word))
                ):
                    for i in range(len(word)):
                        grid[start_row - i][start_col + i] = word[i]
                    placed = True
            elif direction == "verticalUp":
                start_row = random.randint(len(word) - 1, rows - 1)
                start_col = random.randint(0, cols - 1)
                if all(
                    grid[start_row - i][start_col] == " "
                    or grid[start_row - i][start_col] == word[i]
                    for i in range(len(word))
                ):
                    for i in range(len(word)):
                        grid[start_row - i][start_col] = word[i]
                    placed = True
            elif direction == "horizontalBackward":
                start_row = random.randint(0, rows - 1)
                start_col = random.randint(len(word) - 1, cols - 1)
                if all(
                    grid[start_row][start_col - i] == " "
                    or grid[start_row][start_col - i] == word[i]
                    for i in range(len(word))
                ):
                    for i in range(len(word)):
                        grid[start_row][start_col - i] = word[i]
                    placed = True
    # Fill the remaining empty spaces with random letters

    for i in range(rows):
        for j in range(cols):
            if grid[i][j] == " ":
                grid[i][j] = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    return grid


def print_word_search(grid):
    for row in grid:
        print(" ".join(row))


# Example usage:
words_to_find = [
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
]


i = 1

while True:
    print(i)
    word_search_grid = generate_word_search(words_to_find)
    print_word_search(word_search_grid)

    i += 1
