const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const { joinRoom, leaveRoom, startGame, getRoom, endRound } = require('./roomManager');
const { checkColumns, checkRows, removeColumns, removeRows, isGridFullyRevealed } = require('./gameEngine');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 15000,
  pingTimeout: 30000,
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', ({ roomId, playerName }) => {
    const result = joinRoom(roomId, { id: socket.id, name: playerName });
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }

    socket.join(roomId);
    io.to(roomId).emit('room_state_update', getRoom(roomId));
  });

  socket.on('start_game', (roomId) => {
    const started = startGame(roomId);
    if (started) {
      io.to(roomId).emit('room_state_update', getRoom(roomId));
      io.to(roomId).emit('game_started');
    }
  });

  // Action: Flip Initial Cards (2 cards required before turns start)
  socket.on('flip_setup_card', ({ roomId, cardIndex }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (player.grid[cardIndex]) {
      player.grid[cardIndex].isFaceUp = true;
    }

    // Check if all players flipped 2 cards (Simplified: assuming they do)
    io.to(roomId).emit('room_state_update', room);
  });

  // Action: Draw from Deck
  socket.on('draw_deck', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || room.players[room.currentPlayerIndex].id !== socket.id) return;

    const card = room.deck.pop();
    socket.emit('drew_card', card); // Send secretly to the player who drew it
  });

  // Action: Draw from Discard
  socket.on('draw_discard', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || room.players[room.currentPlayerIndex].id !== socket.id) return;

    const card = room.discardPile.pop();
    socket.emit('drew_card', card);
  });

  // Action: Swap Card in Grid
  socket.on('swap_card', ({ roomId, cardIndex, newCard }) => {
    const room = getRoom(roomId);
    if (!room || room.players[room.currentPlayerIndex].id !== socket.id) return;

    const player = room.players[room.currentPlayerIndex];
    const oldCard = player.grid[cardIndex];

    // Swap card
    player.grid[cardIndex] = { value: newCard, isFaceUp: true };

    // Discard old card
    if (oldCard) {
      room.discardPile.push(oldCard.value);
    }

    // Check Column and Row Rules
    const colsToDrop = checkColumns(player.grid);
    if (colsToDrop.length > 0) {
      const discards = removeColumns(player.grid, colsToDrop);
      room.discardPile.push(...discards);
    }

    const rowsToDrop = checkRows(player.grid);
    if (rowsToDrop.length > 0) {
      const discards = removeRows(player.grid, rowsToDrop);
      room.discardPile.push(...discards);
    }

    // Check End Round Trigger
    if (room.roundEnderIndex === null && isGridFullyRevealed(player.grid)) {
      room.roundEnderIndex = room.currentPlayerIndex;
      io.to(roomId).emit('skyjo_called', player.name);
    }

    // Next Turn Setup
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

    // Check if round is over
    if (room.roundEnderIndex !== null && room.currentPlayerIndex === room.roundEnderIndex) {
      endRound(roomId);
      io.to(roomId).emit('room_state_update', room);
      io.to(roomId).emit('game_ended', room.winner);
    } else {
      io.to(roomId).emit('room_state_update', room);
    }
  });

  // Action: Discard Drawn Card & Flip a Grid Card
  socket.on('discard_and_flip', ({ roomId, discardedCard, flipIndex }) => {
    const room = getRoom(roomId);
    if (!room || room.players[room.currentPlayerIndex].id !== socket.id) return;

    const player = room.players[room.currentPlayerIndex];
    room.discardPile.push(discardedCard);

    if (player.grid[flipIndex]) {
      player.grid[flipIndex].isFaceUp = true;
    }

    // Rule Checking again after flip
    const colsToDrop = checkColumns(player.grid);
    if (colsToDrop.length > 0) {
      const discards = removeColumns(player.grid, colsToDrop);
      room.discardPile.push(...discards);
    }

    const rowsToDrop = checkRows(player.grid);
    if (rowsToDrop.length > 0) {
      const discards = removeRows(player.grid, rowsToDrop);
      room.discardPile.push(...discards);
    }

    // Check End Round Trigger
    if (room.roundEnderIndex === null && isGridFullyRevealed(player.grid)) {
      room.roundEnderIndex = room.currentPlayerIndex;
      io.to(roomId).emit('skyjo_called', player.name);
    }

    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

    if (room.roundEnderIndex !== null && room.currentPlayerIndex === room.roundEnderIndex) {
      endRound(roomId);
      io.to(roomId).emit('room_state_update', room);
      io.to(roomId).emit('game_ended', room.winner);
    } else {
      io.to(roomId).emit('room_state_update', room);
    }
  });

  socket.on('vote_play_again', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.wantsToPlayAgain = true;
      io.to(roomId).emit('room_state_update', room);

      const allReady = room.players.every(p => p.wantsToPlayAgain);
      if (allReady && room.players.length > 1) {
        startGame(roomId);
        io.to(roomId).emit('room_state_update', getRoom(roomId));
        io.to(roomId).emit('game_started');
      }
    }
  });


  socket.on('leave_room', ({ roomId }) => {
    const { rooms } = require('./roomManager');
    const room = rooms[roomId];
    if (room && room.players.find(p => p.id === socket.id)) {
      leaveRoom(roomId, socket.id);
      socket.leave(roomId);
      io.to(roomId).emit('room_state_update', rooms[roomId]);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const { rooms } = require('./roomManager');
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players.find(p => p.id === socket.id)) {
        leaveRoom(roomId, socket.id);
        io.to(roomId).emit('room_state_update', rooms[roomId]);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
