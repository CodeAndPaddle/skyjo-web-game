/**
 * Skyjo Game Engine
 * Handles deck creation, shuffling, dealing, and rule validation.
 */

const CARD_COUNTS = {
    '-2': 5,
    '-1': 10,
    '0': 15,
    '1': 10,
    '2': 10,
    '3': 10,
    '4': 10,
    '5': 10,
    '6': 10,
    '7': 10,
    '8': 10,
    '9': 10,
    '10': 10,
    '11': 10,
    '12': 10
};

// 1. Deck Generation
function createDeck() {
    let deck = [];
    for (const [value, count] of Object.entries(CARD_COUNTS)) {
        for (let i = 0; i < count; i++) {
            deck.push(parseInt(value));
        }
    }
    return shuffle(deck);
}

// 2. Shuffling (Fisher-Yates)
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// 3. Player Initialization
// A player's grid is an array of 12 objects { value: number, isFaceUp: boolean }
function createPlayerGrid(deck) {
    const grid = [];
    for (let i = 0; i < 12; i++) {
        grid.push({
            value: deck.pop(),
            isFaceUp: false
        });
    }
    return grid;
}

// 4. Checking Standard Columns
// Assuming a 3x4 grid mapped 1D: [0,1,2,3, 4,5,6,7, 8,9,10,11]
function checkColumns(grid) {
    let columnsToRemove = [];
    for (let col = 0; col < 4; col++) {
        let valuesInCol = [];
        let allFaceUp = true;

        for (let row = 0; row < 3; row++) {
            const index = row * 4 + col;
            const card = grid[index];
            if (card !== null) {
                if (!card.isFaceUp) {
                    allFaceUp = false;
                    break;
                }
                valuesInCol.push(card.value);
            }
        }

        if (allFaceUp && valuesInCol.length >= 2) {
            const firstVal = valuesInCol[0];
            const allMatch = valuesInCol.every(v => v === firstVal);
            if (allMatch) {
                columnsToRemove.push(col);
            }
        }
    }
    return columnsToRemove;
}

// 5. Checking Custom Rows
// Eliminates remaining rows matching on identically revealed cards
function checkRows(grid) {
    let rowsToRemove = [];
    for (let row = 0; row < 3; row++) {
        let valuesInRow = [];
        let allFaceUp = true;

        for (let col = 0; col < 4; col++) {
            const index = row * 4 + col;
            const card = grid[index];
            if (card !== null) {
                if (!card.isFaceUp) {
                    allFaceUp = false;
                    break;
                }
                valuesInRow.push(card.value);
            }
        }

        if (allFaceUp && valuesInRow.length >= 2) {
            // Check if all collected values are identical
            const firstVal = valuesInRow[0];
            const allMatch = valuesInRow.every(v => v === firstVal);
            if (allMatch) {
                rowsToRemove.push(row);
            }
        }
    }
    return rowsToRemove;
}

// Helper: Discard columns from grid (setting to null)
// Returns the discarded cards to add back to the discard pile
function removeColumns(grid, columns) {
    let discarded = [];
    columns.forEach(col => {
        discarded.push(grid[col].value, grid[col + 4].value, grid[col + 8].value);
        grid[col] = null;
        grid[col + 4] = null;
        grid[col + 8] = null;
    });
    return discarded;
}

// Helper: Discard rows from grid (setting to null)
function removeRows(grid, rows) {
    let discarded = [];
    rows.forEach(row => {
        for (let col = 0; col < 4; col++) {
            const idx = row * 4 + col;
            if (grid[idx] !== null) {
                discarded.push(grid[idx].value);
                grid[idx] = null;
            }
        }
    });
    return discarded;
}

// Helper: Calculate score
function calculateScore(grid) {
    return grid.reduce((sum, card) => {
        if (card === null) return sum;
        return sum + card.value;
    }, 0);
}

// Helper: Check if grid is fully revealed (triggers end of round)
function isGridFullyRevealed(grid) {
    return grid.every(card => card === null || card.isFaceUp);
}


module.exports = {
    createDeck,
    createPlayerGrid,
    checkColumns,
    checkRows,
    removeColumns,
    removeRows,
    calculateScore,
    isGridFullyRevealed
};
