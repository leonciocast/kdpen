import random


def create_crossword(words):
    # Find the size of the grid
    max_length = max(len(word) for word in words)
    grid_size = max_length * 2

    # Initialize an empty grid
    grid = [[" " for _ in range(grid_size)] for _ in range(grid_size)]

    # Place words horizontally and vertically
    for word in words:
        placed = False
        while not placed:
            direction = random.choice(["horizontal", "vertical"])
            if direction == "horizontal":
                row = random.randint(0, grid_size - 1)
                col = random.randint(0, grid_size - len(word))
                overlap = False
                for i in range(len(word)):
                    if grid[row][col + i] != " " and grid[row][col + i] != word[i]:
                        overlap = True
                        break
                if not overlap:
                    for i in range(len(word)):
                        grid[row][col + i] = word[i]
                    placed = True
            else:  # direction == 'vertical'
                row = random.randint(0, grid_size - len(word))
                col = random.randint(0, grid_size - 1)
                overlap = False
                for i in range(len(word)):
                    if grid[row + i][col] != " " and grid[row + i][col] != word[i]:
                        overlap = True
                        break
                if not overlap:
                    for i in range(len(word)):
                        grid[row + i][col] = word[i]
                    placed = True

    return grid


def display_crossword(grid):
    for row in grid:
        print(" ".join(row))


# Example usage:
words = [
    "cryptobuzz",
    "technofiesta",
    "innovatrix",
    "neurospark",
    "quantaverse",
    "cyberfusion",
    "synthify",
    "robozenith",
    "nanoglow",
    "bioharmony",
    "cosmicode",
    "dataloom",
    "quantumize",
    "aeroflare",
    "nanomind",
    "bioterra",
    "robohive",
    "skyquest",
    "metamatrix",
    "cyberpulse",
    "fluxify",
    "technoluxe",
    "quantifyme",
    "nanozen",
    "genomatrix",
    "stellaris",
    "neuroflare",
    # "vibranova",
    # "synthros",
    # "innovista",
    # "orbiquant",
    # "cybernect",
    # "metaverse",
    # "robonova",
    # "nanopulse",
    # "bioquark",
    # "neurofuse",
    # "quantogen",
    # "cosmozen",
    # "synergize",
    # "futuromind",
    # "galaxify",
    # "quantalia",
    # "neurofizz",
    # "nanoquest",
    # "synthverse",
    # "innovify",
    # "techsorcery",
]

crossword_grid = create_crossword(words)
display_crossword(crossword_grid)
