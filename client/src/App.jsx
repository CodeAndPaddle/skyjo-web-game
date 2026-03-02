import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const socket = io(`http://${window.location.hostname}:3001`)

function App() {
    const [roomId, setRoomId] = useState('')
    const [playerName, setPlayerName] = useState('')
    const [roomState, setRoomState] = useState(null)
    const [error, setError] = useState('')
    const [drawnCard, setDrawnCard] = useState(null) // Keep track of the card the player just drew

    const [pendingFlip, setPendingFlip] = useState(false)

    useEffect(() => {
        socket.on('room_state_update', (state) => {
            setRoomState(state)
        })

        socket.on('error', (msg) => {
            setError(msg)
            setTimeout(() => setError(''), 3000)
        })

        socket.on('drew_card', (cardValue) => {
            setDrawnCard(cardValue)
            setPendingFlip(false)
        })

        return () => {
            socket.off('room_state_update')
            socket.off('error')
            socket.off('drew_card')
        }
    }, [])

    const joinRoom = (e) => {
        e.preventDefault()
        if (!roomId || !playerName) return
        socket.emit('join_room', { roomId, playerName })
    }

    const startGame = () => {
        socket.emit('start_game', roomId)
    }

    // --- Game Actions ---
    const handleDrawDeck = () => {
        if (drawnCard !== null) {
            setError("You already drew a card!")
            return;
        }
        socket.emit('draw_deck', { roomId })
    }

    const handleDrawDiscard = () => {
        if (drawnCard !== null) {
            setError("You already drew a card!")
            return;
        }
        socket.emit('draw_discard', { roomId })
    }

    const handleGridClick = (cardIndex) => {
        if (roomState.gameState === 'LOBBY' || !isMyTurn()) {
            socket.emit('flip_setup_card', { roomId, cardIndex })
            return
        }

        if (pendingFlip && drawnCard !== null) {
            socket.emit('discard_and_flip', { roomId, discardedCard: drawnCard, flipIndex: cardIndex })
            setDrawnCard(null)
            setPendingFlip(false)
            return
        }

        if (drawnCard !== null) {
            socket.emit('swap_card', { roomId, cardIndex, newCard: drawnCard })
            setDrawnCard(null)
        } else {
            setError('Draw a card from the deck or discard pile first!')
        }
    }

    const handleDiscardDrawn = () => {
        if (drawnCard !== null) {
            setPendingFlip(true)
        }
    }

    const isMyTurn = () => {
        if (!roomState || roomState.gameState !== 'PLAYING') return false;
        const me = roomState.players.find(p => p.id === socket.id);
        const currentPlayer = roomState.players[roomState.currentPlayerIndex];
        return me && currentPlayer && me.id === currentPlayer.id;
    }

    if (!roomState) {
        return (
            <div className="lobby-container">
                <h1>Skyjo Web Game</h1>
                <form onSubmit={joinRoom} className="join-form">
                    <input
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value)}
                        placeholder="Your Name"
                        className="input-field"
                    />
                    <input
                        value={roomId}
                        onChange={e => setRoomId(e.target.value)}
                        placeholder="Room ID"
                        className="input-field"
                    />
                    <button type="submit" className="btn primary">Join Game</button>
                </form>
                {error && <p className="error">{error}</p>}
            </div>
        )
    }

    return (
        <div className="game-container">
            <header className="game-header">
                <h2>Room: {roomId}</h2>
                {roomState.gameState === 'LOBBY' && (
                    <button onClick={startGame} className="btn success">Start Game</button>
                )}
                <div className="turn-indicator">
                    {isMyTurn() ? "🟢 YOUR TURN" : `⏳ Waiting for ${roomState.players[roomState.currentPlayerIndex]?.name}`}
                </div>
            </header>

            {error && <div className="error-banner">{error}</div>}

            {roomState.gameState === 'PLAYING' && (
                <div className="table-center">
                    <div className="deck-area">
                        <div className="card back" onClick={handleDrawDeck}>
                            Deck ({roomState.deck.length})
                        </div>
                        <div className="card face-up" onClick={handleDrawDiscard}>
                            {roomState.discardPile.length > 0 ? roomState.discardPile[roomState.discardPile.length - 1] : 'Empty'}
                        </div>
                    </div>
                </div>
            )}

            {drawnCard !== null && (
                <div className="action-area" style={{ marginTop: '2rem' }}>
                    <p>You drew: <span className="card face-up small">{drawnCard}</span></p>

                    {!pendingFlip ? (
                        <>
                            <p>Click a card in your grid to swap, or:</p>
                            <button className="btn danger" onClick={handleDiscardDrawn}>Discard Drawn Card</button>
                        </>
                    ) : (
                        <p style={{ color: '#58a6ff', fontWeight: 'bold' }}>Now click a face-down card in your grid to reveal it!</p>
                    )}
                </div>
            )}

            <div className="players-grid-container" style={{ marginTop: '3rem' }}>
                {roomState.players.map(player => (
                    <div key={player.id} className={`player-board ${player.id === socket.id ? 'me' : ''}`}>
                        <h3>{player.name}</h3>
                        <div className="grid">
                            {player.grid.map((card, idx) => (
                                <div
                                    key={idx}
                                    className={`card ${card ? (card.isFaceUp ? 'face-up' : 'back') : 'empty'}`}
                                    onClick={() => player.id === socket.id && handleGridClick(idx)}
                                >
                                    {card ? (card.isFaceUp ? card.value : 'SKYJO') : ''}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default App
