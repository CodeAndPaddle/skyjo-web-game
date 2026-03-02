/**
 * Room and State Manager
 */

const { createDeck, createPlayerGrid, calculateScore } = require('./gameEngine');

const rooms = {};

function createRoom(roomId) {
    rooms[roomId] = {
        players: [],
        gameState: 'LOBBY', // LOBBY, PLAYING, ENDED
        deck: [],
        discardPile: [],
        currentPlayerIndex: 0,
        roundEnderIndex: null,
    };
    return rooms[roomId];
}

function getRoom(roomId) {
    return rooms[roomId];
}

function joinRoom(roomId, player) {
    if (!rooms[roomId]) {
        createRoom(roomId);
    }
    const room = rooms[roomId];

    // Check if game already started
    if (room.gameState !== 'LOBBY') {
        return { error: "Game already in progress" };
    }

    if (room.players.length >= 8) {
        return { error: "Room is full" };
    }

    room.players.push({
        id: player.id,
        name: player.name,
        grid: [],
        score: 0,
        totalScore: 0,
        isReady: false,
        wantsToPlayAgain: false
    });

    return { room };
}

function leaveRoom(roomId, playerId) {
    const room = rooms[roomId];
    if (room) {
        room.players = room.players.filter(p => p.id !== playerId);
        if (room.players.length === 0) {
            delete rooms[roomId];
        }
    }
}

function startGame(roomId) {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return false;

    room.gameState = 'PLAYING';
    room.deck = createDeck();
    room.discardPile = [room.deck.pop()]; // First card face up

    // Deal 12 cards to each player
    room.players.forEach(player => {
        player.grid = createPlayerGrid(room.deck);
        player.score = 0; // reset round score
        player.wantsToPlayAgain = false;
    });

    room.currentPlayerIndex = 0;
    room.roundEnderIndex = null;
    room.winner = null;

    return true;
}

function endRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    room.gameState = 'ENDED';

    // Reveal all remaining cards and score
    room.players.forEach(player => {
        player.grid.forEach(card => {
            if (card) {
                card.isFaceUp = true;
            }
        });
        player.score = calculateScore(player.grid);
    });

    // Check Skyjo Penalty
    // If the person who ended the round (called Skyjo) does NOT have the strictly lowest score
    const caller = room.players[room.roundEnderIndex];
    if (caller) {
        const isStrictlyLowest = room.players.every(p => {
            if (p.id === caller.id) return true;
            return caller.score < p.score;
        });

        if (!isStrictlyLowest) {
            caller.score = caller.score > 0 ? caller.score * 2 : (Math.abs(caller.score) * 2) || 15;
            caller.penaltyApplied = true;
        } else {
            caller.penaltyApplied = false;
        }
    }

    // Determine winner of the round
    let lowestScore = Infinity;
    let winner = null;
    room.players.forEach(p => {
        if (p.score < lowestScore) {
            lowestScore = p.score;
            winner = p;
        }
    });

    room.winner = winner;

    // Accumulate total scores
    room.players.forEach(p => {
        p.totalScore += p.score;
    });
}

module.exports = {
    createRoom,
    getRoom,
    joinRoom,
    leaveRoom,
    startGame,
    endRound,
    rooms
};
