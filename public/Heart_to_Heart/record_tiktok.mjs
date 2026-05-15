import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = __dirname;
const SONG_DURATION = 162;
const OUT_MP4  = resolve(DIR, 'Heart_to_Heart_tiktok.mp4');
const AUDIO    = resolve(DIR, 'Heart_to_Heart.mp3');
const TEMP_HTML = resolve(DIR, '_record_tiktok_temp.html');

// ── Build TikTok-optimised HTML (1080×1920, no bottom bar) ───────────────────
const original = readFileSync(resolve(DIR, 'index.html'), 'utf8');

const tiktokOverrides = `
<style>
/* Hide player controls — TikTok has its own UI */
.bottom-bar { display: none !important; }
.start-screen { display: none !important; }

/* Larger lyrics for vertical mobile */
.lyric-text {
  font-size: clamp(1.8rem, 6vw, 3.2rem) !important;
  line-height: 1.6 !important;
}
.lyric.chorus .lyric-text {
  font-size: clamp(2rem, 6.5vw, 3.6rem) !important;
}
.lyric.bridge .lyric-text {
  font-size: clamp(1.6rem, 5.5vw, 2.8rem) !important;
}
.lyrics-container {
  bottom: 200px !important;
  padding: 30px !important;
}

/* Title & author overlay */
.rec-title {
  position: fixed; top: 80px; left: 0; right: 0; z-index: 50;
  text-align: center; pointer-events: none;
  opacity: 1; transition: opacity 1.2s ease;
}
.rec-title span {
  font-family: 'Cormorant Garamond', serif; font-weight: 300;
  font-size: 1.5rem; letter-spacing: 5px; text-transform: uppercase;
  color: rgba(245,240,232,0.65);
  text-shadow: 0 1px 16px rgba(0,0,0,0.95);
}
.rec-author {
  position: fixed; bottom: 220px; left: 0; right: 0; z-index: 50;
  text-align: center; pointer-events: none;
  opacity: 1; transition: opacity 1.2s ease;
}
.rec-author span {
  font-size: 0.75rem; font-weight: 200; letter-spacing: 5px; text-transform: uppercase;
  color: rgba(196,163,90,0.6);
  text-shadow: 0 1px 10px rgba(0,0,0,0.95);
}
</style>

<div class="rec-title" id="recTitle"><span>Heart to Heart</span></div>
<div class="rec-author" id="recAuthor"><span>Soglia Lucida</span></div>

<script>
window.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('audio');
  if (audio) {
    audio.play().catch(() => {});
    const playIcon = document.getElementById('playIcon');
    const playBtn  = document.getElementById('playBtn');
    if (playIcon) playIcon.innerHTML = '<rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/>';
    if (playBtn)  playBtn.classList.add('playing');
  }
  setTimeout(() => {
    const t = document.getElementById('recTitle');
    const a = document.getElementById('recAuthor');
    if (t) t.style.opacity = '0';
    if (a) a.style.opacity = '0';
  }, 5000);
});
</script>
`;

const modifiedHTML = original.replace('</body>', tiktokOverrides + '\n</body>');
writeFileSync(TEMP_HTML, modifiedHTML);
console.log('✓ TikTok HTML written (1080×1920)');

// ── Record ────────────────────────────────────────────────────────────────────
console.log(`\nRecording ${SONG_DURATION}s … (takes a while)`);

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});

const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  recordVideo: {
    dir: DIR,
    size: { width: 1080, height: 1920 },
  },
});

const page = await context.newPage();
await page.goto(`file://${TEMP_HTML}`);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const a = document.getElementById('audio');
  if (a && a.paused) a.play().catch(() => {});
});

console.log('Recording in progress…');
await page.waitForTimeout(SONG_DURATION * 1000);

await context.close();
await browser.close();

// ── Find WebM ─────────────────────────────────────────────────────────────────
const allWebm = readdirSync(DIR).filter(f => f.endsWith('.webm'));
if (allWebm.length === 0) { console.error('No WebM found.'); process.exit(1); }
const newestWebm = allWebm
  .map(f => ({ f, mt: statSync(resolve(DIR, f)).mtimeMs }))
  .sort((a, b) => b.mt - a.mt)[0].f;
const rawWebm = resolve(DIR, newestWebm);
console.log(`✓ WebM: ${newestWebm}`);

// ── Merge with ffmpeg ─────────────────────────────────────────────────────────
console.log('\nMerging video + audio…');

const { default: ffmpegPath } = await import('ffmpeg-static');

await new Promise((res, rej) => {
  const ff = spawn(ffmpegPath, [
    '-y',
    '-i', rawWebm,
    '-i', AUDIO,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    OUT_MP4,
  ], { stdio: 'inherit' });
  ff.on('close', code => code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)));
});

unlinkSync(rawWebm);
unlinkSync(TEMP_HTML);

console.log(`\n✓ TikTok video saved:\n  ${OUT_MP4}`);
