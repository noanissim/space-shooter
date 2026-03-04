import Game from './Game.jsx'

export default function App() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#060614',
      gap: 12,
    }}>
      <h2 style={{ color: '#00ff88', letterSpacing: 3, fontSize: 20 }}>
        ✈ SPACE SHOOTER ✈
      </h2>
      <Game />
      <p style={{ color: '#445', fontSize: 13 }}>
        חצים ← → להזזה &nbsp;|&nbsp; רווח לירייה
      </p>
    </div>
  )
}
