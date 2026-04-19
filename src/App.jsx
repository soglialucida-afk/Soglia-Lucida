import { useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import './index.css'

const SONGS = [
  {
    id: 'hth',
    number: '01',
    title: 'Heart to Heart',
    year: '2024',
    accent: '#f72585',
    accentRgb: '247,37,133',
    excerpt: '"Heart to heart we build\na love that\'s strong and real —\nour bond is our art."',
    href: '/Heart_to_Heart/index.html',
  },
  {
    id: 'bip',
    number: '02',
    title: 'Believe in People',
    year: '2024',
    accent: '#4cc9f0',
    accentRgb: '76,201,240',
    excerpt: '"Can we believe in people?\nLet the love show —\nflowers bud without a doubt."',
    href: '/Believe_in_People_complete/index.html',
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 1, ease: [0.25, 0.46, 0.45, 0.94], delay: i * 0.15 },
  }),
}

function SongCard({ song, index }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.a
      href={song.href}
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        overflow: 'hidden',
        borderTop: `1px solid rgba(${song.accentRgb}, 0.13)`,
      }}
      whileHover={{ x: 8 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Watermark number */}
      <div
        style={{
          position: 'absolute',
          right: -16,
          top: -24,
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'clamp(9rem, 22vw, 16rem)',
          fontWeight: 300,
          lineHeight: 1,
          color: song.accent,
          opacity: hovered ? 0.08 : 0.03,
          userSelect: 'none',
          pointerEvents: 'none',
          letterSpacing: '-0.05em',
          transition: 'opacity 0.6s ease',
        }}
      >
        {song.number}
      </div>

      {/* Hover glow */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `linear-gradient(120deg, rgba(${song.accentRgb},0.1) 0%, transparent 60%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />

      {/* Left accent bar */}
      <motion.div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: `linear-gradient(to bottom, ${song.accent}, transparent)`,
          transformOrigin: 'top',
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />

      {/* Content */}
      <div style={{ padding: '52px 60px 52px 64px', position: 'relative' }}>
        <motion.div
          style={{
            fontSize: '0.58rem',
            letterSpacing: '5px',
            textTransform: 'uppercase',
            fontWeight: 300,
            color: song.accent,
            marginBottom: 18,
          }}
          animate={{ opacity: hovered ? 1 : 0.45 }}
          transition={{ duration: 0.3 }}
        >
          {song.number} &mdash; {song.year}
        </motion.div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <motion.div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 300,
                fontSize: 'clamp(2.6rem, 7vw, 4.4rem)',
                letterSpacing: '-0.01em',
                lineHeight: 1,
                marginBottom: 22,
              }}
              animate={{ color: hovered ? '#ffffff' : '#ede8df' }}
              transition={{ duration: 0.3 }}
            >
              {song.title}
            </motion.div>

            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontWeight: 300,
                fontSize: 'clamp(0.88rem, 1.8vw, 1rem)',
                lineHeight: 1.9,
                color: 'rgba(255,255,255,0.25)',
                whiteSpace: 'pre-line',
              }}
            >
              {song.excerpt}
            </div>
          </div>

          <motion.div
            style={{ fontSize: '1.4rem', color: song.accent, flexShrink: 0, paddingBottom: 4 }}
            animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : -16 }}
            transition={{ duration: 0.3 }}
          >
            →
          </motion.div>
        </div>
      </div>
    </motion.a>
  )
}

export default function App() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const headerY = useTransform(scrollYProgress, [0, 1], [0, -50])
  const headerOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0])

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px calc(80px + env(safe-area-inset-bottom, 0px))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Blob — magenta */}
      <motion.div
        style={{
          position: 'fixed',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(247,37,133,0.15) 0%, transparent 70%)',
          top: -300,
          left: -300,
          pointerEvents: 'none',
          zIndex: 0,
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Blob — cyan */}
      <motion.div
        style={{
          position: 'fixed',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(76,201,240,0.12) 0%, transparent 70%)',
          bottom: -200,
          right: -200,
          pointerEvents: 'none',
          zIndex: 0,
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      {/* Grain */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.045,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 740 }}>

        {/* Header */}
        <motion.header
          style={{ textAlign: 'center', marginBottom: 88, y: headerY, opacity: headerOpacity }}
        >
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.5}
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              fontSize: 'clamp(3.2rem, 10vw, 6.4rem)',
              letterSpacing: '0.06em',
              color: '#fff',
              lineHeight: 1,
              marginBottom: 20,
            }}
          >
            Soglia Lucida
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            style={{
              fontSize: '0.65rem',
              letterSpacing: '5px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.22)',
              fontWeight: 200,
            }}
          >
            Razburkan horizont
          </motion.div>

          {/* Gradient divider */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              marginTop: 40,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(247,37,133,0.65), rgba(76,201,240,0.65), transparent)',
              transformOrigin: 'center',
            }}
          />
        </motion.header>

        {/* Songs */}
        <div>
          {SONGS.map((song, i) => (
            <SongCard key={song.id} song={song} index={i + 2} />
          ))}
        </div>

        {/* Footer */}
        <motion.footer
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={5}
          style={{
            marginTop: 64,
            textAlign: 'center',
            fontSize: '0.58rem',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.1)',
            fontWeight: 200,
          }}
        >
          © Soglia Lucida — All rights reserved
        </motion.footer>
      </div>
    </div>
  )
}