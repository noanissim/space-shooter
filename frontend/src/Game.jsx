import { useEffect, useRef, useState, useCallback } from 'react'

const W = 900
const H = 640
const PLAYER_W = 65
const PLAYER_H = 85
const ENEMY_W = 60
const ENEMY_H = 70
const PLAYER_SPEED = 6
const BULLET_SPEED = 10
const ENEMY_BULLET_SPEED = 4
const ENEMY_ROWS = 3
const ENEMY_COLS = 8
const ENEMY_GAP_X = 18
const ENEMY_GAP_Y = 18

function makeStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.7 + 0.3,
  }))
}

function initState() {
  const enemies = []
  const totalW = ENEMY_COLS * ENEMY_W + (ENEMY_COLS - 1) * ENEMY_GAP_X
  const startX = (W - totalW) / 2

  for (let row = 0; row < ENEMY_ROWS; row++) {
    for (let col = 0; col < ENEMY_COLS; col++) {
      enemies.push({
        x: startX + col * (ENEMY_W + ENEMY_GAP_X),
        y: 55 + row * (ENEMY_H + ENEMY_GAP_Y),
        alive: true,
      })
    }
  }

  return {
    player: { x: W / 2 - PLAYER_W / 2, y: H - PLAYER_H - 25 },
    enemies,
    bullets: [],
    enemyBullets: [],
    score: 0,
    lives: 3,
    enemyDir: 1,
    enemySpeed: 0.7,
    shootCooldown: 0,
    enemyShootTimer: 60,
  }
}

function drawFrame(ctx, gs, images, stars) {
  // Background
  ctx.fillStyle = '#060614'
  ctx.fillRect(0, 0, W, H)

  // Stars
  for (const s of stars) {
    ctx.globalAlpha = s.alpha
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Player
  if (images.idf) {
    ctx.drawImage(images.idf, gs.player.x, gs.player.y, PLAYER_W, PLAYER_H)
  } else {
    ctx.fillStyle = '#00aaff'
    ctx.fillRect(gs.player.x, gs.player.y, PLAYER_W, PLAYER_H)
  }

  // Enemies
  for (const e of gs.enemies) {
    if (!e.alive) continue
    if (images.khamenei) {
      ctx.drawImage(images.khamenei, e.x, e.y, ENEMY_W, ENEMY_H)
    } else {
      ctx.fillStyle = '#ff3300'
      ctx.fillRect(e.x, e.y, ENEMY_W, ENEMY_H)
    }
  }

  // Player bullets (green glow)
  ctx.shadowColor = '#00ff88'
  ctx.shadowBlur = 10
  ctx.fillStyle = '#00ff88'
  for (const b of gs.bullets) {
    ctx.fillRect(b.x, b.y, 5, 16)
  }
  ctx.shadowBlur = 0

  // Enemy bullets (red glow)
  ctx.shadowColor = '#ff4400'
  ctx.shadowBlur = 10
  ctx.fillStyle = '#ff4400'
  for (const b of gs.enemyBullets) {
    ctx.fillRect(b.x, b.y, 5, 16)
  }
  ctx.shadowBlur = 0

  // Ground line
  ctx.strokeStyle = '#1a1a3a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, H - 12)
  ctx.lineTo(W, H - 12)
  ctx.stroke()

  // Score
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`ניקוד: ${gs.score}`, 18, 28)

  // Lives
  ctx.textAlign = 'right'
  const hearts = '♥ '.repeat(gs.lives).trim()
  ctx.fillStyle = '#ff4466'
  ctx.fillText(hearts, W - 18, 28)
}

export default function Game() {
  const canvasRef = useRef(null)
  const gsRef = useRef(null)
  const keysRef = useRef({})
  const imagesRef = useRef({ idf: null, khamenei: null, loaded: 0 })
  const animRef = useRef(null)
  const starsRef = useRef(makeStars(100))

  const [status, setStatus] = useState('loading')
  const [finalScore, setFinalScore] = useState(0)
  const [highScores, setHighScores] = useState([])
  const [playerName, setPlayerName] = useState('')
  const [scoreSaved, setScoreSaved] = useState(false)

  // Load images
  useEffect(() => {
    const imgs = imagesRef.current
    const tryStart = () => {
      imgs.loaded++
      if (imgs.loaded === 2) {
        gsRef.current = initState()
        setStatus('playing')
      }
    }

    const idf = new Image()
    idf.src = '/idf.png'
    idf.onload = () => { imgs.idf = idf; tryStart() }
    idf.onerror = tryStart

    const kh = new Image()
    kh.src = '/khamenei.png'
    kh.onload = () => { imgs.khamenei = kh; tryStart() }
    kh.onerror = tryStart
  }, [])

  // Keyboard
  useEffect(() => {
    const down = (e) => {
      keysRef.current[e.code] = true
      if (['Space', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    }
    const up = (e) => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const fetchScores = useCallback(() => {
    const stored = JSON.parse(localStorage.getItem('spaceshooter_scores') || '[]')
    setHighScores(stored)
  }, [])

  useEffect(() => {
    if (status === 'gameover' || status === 'won') fetchScores()
  }, [status, fetchScores])

  const saveScore = () => {
    if (!playerName.trim()) return
    const existing = JSON.parse(localStorage.getItem('spaceshooter_scores') || '[]')
    const updated = [...existing, { name: playerName.trim(), score: finalScore }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
    localStorage.setItem('spaceshooter_scores', JSON.stringify(updated))
    setHighScores(updated)
    setScoreSaved(true)
  }

  // Game loop
  useEffect(() => {
    if (status !== 'playing') {
      cancelAnimationFrame(animRef.current)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const loop = () => {
      const gs = gsRef.current
      if (!gs) return

      // Player move
      if (keysRef.current['ArrowLeft']) gs.player.x = Math.max(0, gs.player.x - PLAYER_SPEED)
      if (keysRef.current['ArrowRight']) gs.player.x = Math.min(W - PLAYER_W, gs.player.x + PLAYER_SPEED)

      // Player shoot
      if (keysRef.current['Space'] && gs.shootCooldown <= 0) {
        gs.bullets.push({ x: gs.player.x + PLAYER_W / 2 - 2, y: gs.player.y })
        gs.shootCooldown = 16
      }
      if (gs.shootCooldown > 0) gs.shootCooldown--

      // Move player bullets
      for (let i = gs.bullets.length - 1; i >= 0; i--) {
        gs.bullets[i].y -= BULLET_SPEED
        if (gs.bullets[i].y < -20) gs.bullets.splice(i, 1)
      }

      // Move enemy bullets
      for (let i = gs.enemyBullets.length - 1; i >= 0; i--) {
        gs.enemyBullets[i].y += ENEMY_BULLET_SPEED
        if (gs.enemyBullets[i].y > H + 20) gs.enemyBullets.splice(i, 1)
      }

      // Move enemies
      const alive = gs.enemies.filter(e => e.alive)
      let hitWall = false
      for (const e of alive) e.x += gs.enemyDir * gs.enemySpeed
      for (const e of alive) {
        if (e.x <= 0 || e.x + ENEMY_W >= W) { hitWall = true; break }
      }
      if (hitWall) {
        gs.enemyDir *= -1
        for (const e of alive) e.y += 22
        gs.enemySpeed = Math.min(gs.enemySpeed + 0.12, 5)
      }

      // Enemy shoot
      gs.enemyShootTimer--
      if (gs.enemyShootTimer <= 0 && alive.length > 0) {
        const shooter = alive[Math.floor(Math.random() * alive.length)]
        gs.enemyBullets.push({ x: shooter.x + ENEMY_W / 2 - 2, y: shooter.y + ENEMY_H })
        gs.enemyShootTimer = Math.floor(Math.random() * 50) + 30
      }

      // Bullet ↔ enemy collisions
      for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
        const b = gs.bullets[bi]
        let hit = false
        for (const e of gs.enemies) {
          if (!e.alive) continue
          if (b.x < e.x + ENEMY_W && b.x + 5 > e.x && b.y < e.y + ENEMY_H && b.y + 16 > e.y) {
            e.alive = false
            hit = true
            gs.score += 100
            gs.enemySpeed = Math.min(gs.enemySpeed + 0.04, 5)
            break
          }
        }
        if (hit) gs.bullets.splice(bi, 1)
      }

      // Enemy bullet ↔ player collisions
      for (let bi = gs.enemyBullets.length - 1; bi >= 0; bi--) {
        const b = gs.enemyBullets[bi]
        const p = gs.player
        if (b.x < p.x + PLAYER_W && b.x + 5 > p.x && b.y < p.y + PLAYER_H && b.y + 16 > p.y) {
          gs.enemyBullets.splice(bi, 1)
          gs.lives--
        }
      }

      // Enemies reached the player
      for (const e of alive) {
        if (e.y + ENEMY_H >= gs.player.y + 10) { gs.lives = 0; break }
      }

      // Draw
      drawFrame(ctx, gs, imagesRef.current, starsRef.current)

      // Check end conditions
      if (gs.lives <= 0) {
        setFinalScore(gs.score)
        setStatus('gameover')
        return
      }
      if (gs.enemies.every(e => !e.alive)) {
        setFinalScore(gs.score)
        setStatus('won')
        return
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [status])

  const restart = () => {
    gsRef.current = initState()
    setFinalScore(0)
    setPlayerName('')
    setScoreSaved(false)
    setStatus('playing')
  }

  if (status === 'loading') {
    return (
      <div style={{ color: '#00ff88', fontSize: 22, padding: 40 }}>טוען...</div>
    )
  }

  const press = (code) => { keysRef.current[code] = true }
  const release = (code) => { keysRef.current[code] = false }

  return (
    <div style={{ width: '100%', maxWidth: W, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ border: '1px solid #1a1a3a', display: 'block', width: '100%', height: 'auto' }}
      />

      {(status === 'gameover' || status === 'won') && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.82)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16,
        }}>
          <h1 style={{ fontSize: 52, color: status === 'won' ? '#00ff88' : '#ff3300', margin: 0 }}>
            {status === 'won' ? '🎉 ניצחת! 🎉' : '💀 GAME OVER'}
          </h1>
          <p style={{ fontSize: 28, color: '#fff', margin: 0 }}>ניקוד: {finalScore}</p>

          {!scoreSaved ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="שם שלך"
                autoFocus
                style={{
                  padding: '8px 18px', fontSize: 18,
                  background: '#10102a', color: '#fff',
                  border: '1px solid #446', borderRadius: 4,
                  textAlign: 'center', outline: 'none',
                }}
                onKeyDown={e => e.key === 'Enter' && saveScore()}
              />
              <button onClick={saveScore} style={btnStyle('#006633')}>
                שמור ניקוד
              </button>
            </div>
          ) : (
            <p style={{ color: '#00ff88', fontSize: 18 }}>✓ הניקוד נשמר!</p>
          )}

          {highScores.length > 0 && (
            <div style={{ color: '#aaa', textAlign: 'center', lineHeight: 1.8 }}>
              <div style={{ color: '#ffcc00', fontSize: 17, marginBottom: 6 }}>🏆 טבלת שיאים</div>
              {highScores.slice(0, 5).map((s, i) => (
                <div key={i} style={{ fontSize: 15 }}>
                  {i + 1}. {s.name} — {s.score}
                </div>
              ))}
            </div>
          )}

          <button onClick={restart} style={btnStyle('#1a2a5a')}>
            שחק שוב
          </button>
        </div>
      )}

      {/* Mobile controls */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 8px', gap: 8, touchAction: 'none', userSelect: 'none',
      }}>
        <TouchBtn
          onPress={() => press('ArrowLeft')}
          onRelease={() => release('ArrowLeft')}
          label="◀"
          color="#1a2a5a"
        />
        <TouchBtn
          onPress={() => press('Space')}
          onRelease={() => release('Space')}
          label="🔥 ירייה"
          color="#006633"
          wide
        />
        <TouchBtn
          onPress={() => press('ArrowRight')}
          onRelease={() => release('ArrowRight')}
          label="▶"
          color="#1a2a5a"
        />
      </div>
    </div>
  )
}

function TouchBtn({ onPress, onRelease, label, color, wide }) {
  return (
    <button
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onPress() }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      style={{
        flex: wide ? 2 : 1,
        padding: '18px 0',
        fontSize: wide ? 22 : 26,
        background: color,
        color: '#fff',
        border: '1px solid #335',
        borderRadius: 8,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
    >
      {label}
    </button>
  )
}

const btnStyle = (bg) => ({
  padding: '9px 28px', fontSize: 18,
  background: bg, color: '#fff',
  border: '1px solid #335', borderRadius: 4,
  cursor: 'pointer', marginTop: 4,
})
