/**
 * Room and State Manager
 */

const { createDeck, createPlayerGrid } = require('./gameEngine');

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
        isReady: false
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
    });

    room.currentPlayerIndex = 0;
    room.roundEnderIndex = null;

    return true;
}

module.exports = {
    createRoom,
    getRoom,
    joinRoom,
    leaveRoom,
    startGame,
    rooms
};
