import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const socket = io('https://skyjo-web-game.onrender.com')

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
            setError('') // Refresh/clear instructions whenever the state successfully updates
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

    const exitRoom = () => {
        socket.emit('leave_room', { roomId })
        setRoomState(null)
        setRoomId('')
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                    <img src="/logo.png" alt="Octopus Logo" className="logo" style={{ height: '80px' }} />
                    <h1>Skyjo Web Game</h1>
                </div>
                <form onSubmit={joinRoom} className="join-form" style={{ marginTop: '1rem' }}>
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
            {/* Accumulating Scoreboard */}
            <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'var(--panel-bg)', padding: '15px', borderRadius: '12px', zIndex: 100, border: '1px solid #30363d' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: 'var(--primary-color)' }}>Scoreboard</h3>
                {roomState.players.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', width: '150px', marginBottom: '5px' }}>
                        <span>{p.name}:</span>
                        <strong>{p.totalScore || 0}</strong>
                    </div>
                ))}
            </div>

            <header className="game-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="/logo.png" alt="Octopus Logo" className="logo" />
                    <h2 style={{ margin: 0 }}>Amelie & Ron Skyjo</h2>
                </div>
                <div style={{ padding: '0 20px', fontSize: '1.2rem', color: '#888', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>Room: {roomId}</span>
                    <button onClick={exitRoom} className="btn danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>Exit Game</button>
                </div>
                {roomState.gameState === 'LOBBY' && (
                    <button onClick={startGame} className="btn success">Start Game</button>
                )}
                <div className="turn-indicator" style={{ marginLeft: 'auto' }}>
                    {isMyTurn() ? "🟢 YOUR TURN" : `⏳ Waiting for ${roomState.players[roomState.currentPlayerIndex]?.name}`}
                </div>
            </header>

            {/* SKYJO Called Banner */}
            {roomState.roundEnderIndex !== null && roomState.gameState === 'PLAYING' && (
                <div style={{ background: 'var(--primary-color)', color: '#000', padding: '15px', textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', width: '100%', borderRadius: '12px', marginTop: '1rem', animation: 'pulse 2s infinite' }}>
                    📢 SKYJO CALLED BY {roomState.players[roomState.roundEnderIndex].name}! Final Turn for everyone else! 📢
                </div>
            )}

            {/* Game Over Modal */}
            {roomState.gameState === 'ENDED' && roomState.winner && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(13, 17, 23, 0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
                    <h1 style={{ fontSize: '4rem', color: 'var(--success-color)', textShadow: '0 0 20px var(--success-color)' }}>{roomState.winner.name} WINS THE ROUND!</h1>
                    <p style={{ fontSize: '2rem', marginBottom: '2rem' }}>Winning Score: {roomState.winner.score}</p>
                    <img src="https://media.tenor.com/_u82e4X99_kAAAAM/floss-dance.gif" alt="Floss Dance" style={{ height: '300px', borderRadius: '20px', marginBottom: '2rem' }} />

                    <div style={{ display: 'flex', gap: '20px' }}>
                        {roomState.players.map(p => (
                            <div key={p.id} style={{ background: 'var(--panel-bg)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #30363d' }}>
                                <h3 style={{ margin: 0 }}>{p.name}</h3>
                                <p style={{ margin: '5px 0' }}>Round Score: {p.score}</p>
                                {p.penaltyApplied && <p style={{ color: 'var(--danger-color)', margin: '0', fontSize: '0.8rem', fontWeight: 'bold' }}>SKYJO PENALTY (x2)</p>}
                                <p style={{ color: p.wantsToPlayAgain ? 'var(--success-color)' : '#888', marginTop: '10px' }}>
                                    {p.wantsToPlayAgain ? '🟢 Ready to Play Again' : '⏳ Waiting...'}
                                </p>
                            </div>
                        ))}
                    </div>

                    <button
                        className="btn primary"
                        style={{ marginTop: '3rem', fontSize: '1.5rem', padding: '15px 40px' }}
                        onClick={() => socket.emit('vote_play_again', { roomId })}
                        disabled={roomState.players.find(p => p.id === socket.id)?.wantsToPlayAgain}
                    >
                        {roomState.players.find(p => p.id === socket.id)?.wantsToPlayAgain ? "Waiting on other player..." : "Play Again"}
                    </button>
                </div>
            )}

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
