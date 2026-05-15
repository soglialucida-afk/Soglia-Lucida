import { chromium } from 'playwright';
import { execSync, spawn } from 'child_process';
import { existsSync, renameSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = __dirname;
const SONG_DURATION = 162; // seconds (a little over the 160s timeline)
const OUT_WEBM = resolve(DIR, 'recording.webm');
const OUT_MP4  = resolve(DIR, 'Heart_to_Heart.mp4');
const AUDIO    = resolve(DIR, 'Heart_to_Heart.mp3');
const TEMP_HTML = resolve(DIR, '_record_temp.html');

// ── 1. Build a recording-optimised HTML ──────────────────────────────────────
const original = readFileSync(resolve(DIR, 'index.html'), 'utf8');

// Inject: title/author overlay (visible 5 s), autoplay on load, hide start screen
const recordingExtra = `
<style>
.rec-title{
  position:fixed;top:32px;left:0;right:0;z-index:50;text-align:center;pointer-events:none;
  opacity:1;transition:opacity 1.2s ease;
}
.rec-title span{
  font-family:'Cormorant Garamond',serif;font-weight:300;
  font-size:1.3rem;letter-spacing:4px;text-transform:uppercase;
  color:rgba(245,240,232,0.6);text-shadow:0 1px 14px rgba(0,0,0,0.95);
}
.rec-author{
  position:fixed;bottom:145px;left:0;right:0;z-index:50;text-align:center;pointer-events:none;
  opacity:1;transition:opacity 1.2s ease;
}
.rec-author span{
  font-size:0.65rem;font-weight:200;letter-spacing:4px;text-transform:uppercase;
  color:rgba(196,163,90,0.55);text-shadow:0 1px 10px rgba(0,0,0,0.95);
}
</style>
<div class="rec-title" id="recTitle"><span>Heart to Heart</span></div>
<div class="rec-author" id="recAuthor"><span>Soglia Lucida</span></div>
<script>
window.addEventListener('DOMContentLoaded', () => {
  // Hide start screen immediately and start playing
  const ss = document.getElementById('startScreen');
  if (ss) { ss.style.display = 'none'; }
  const audio = document.getElementById('audio');
  if (audio) {
    audio.play().catch(() => {});
    // Sync play button state
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    if (playIcon) playIcon.innerHTML = '<rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/>';
    if (playBtn) playBtn.classList.add('playing');
  }
  // Fade out title & author after 5 s
  setTimeout(() => {
    const t = document.getElementById('recTitle');
    const a = document.getElementById('recAuthor');
    if (t) t.style.opacity = '0';
    if (a) a.style.opacity = '0';
  }, 5000);
});
</script>
`;

const modifiedHTML = original.replace('</body>', recordingExtra + '\n</body>');
writeFileSync(TEMP_HTML, modifiedHTML);
console.log('✓ Temporary recording HTML written');

// ── 2. Record with Playwright ─────────────────────────────────────────────────
console.log(`\nRecording ${SONG_DURATION}s of video (this will take a while)…`);

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: {
    dir: DIR,
    size: { width: 1920, height: 1080 },
  },
});

const page = await context.newPage();

// Grant autoplay permission
await context.grantPermissions([]);

await page.goto(`file://${TEMP_HTML}`);

// Wait a moment for fonts/images to load, then ensure audio is playing
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const a = document.getElementById('audio');
  if (a && a.paused) a.play().catch(() => {});
});

console.log('Recording in progress…');
await page.waitForTimeout(SONG_DURATION * 1000);

await context.close();
await browser.close();

// ── 3. Find the generated WebM file ──────────────────────────────────────────
// Playwright names the file something like <uuid>.webm in the recordVideo dir
import { readdirSync } from 'fs';
const webmFiles = readdirSync(DIR)
  .filter(f => f.endsWith('.webm') && f !== 'recording.webm')
  .map(f => ({ f, t: readdirSync(DIR, { withFileTypes: true }).find(e => e.name === f) }));

// Use the most recently modified .webm
const allWebm = readdirSync(DIR).filter(f => f.endsWith('.webm'));
if (allWebm.length === 0) {
  console.error('No WebM file found — recording may have failed.');
  process.exit(1);
}
// Pick newest
import { statSync } from 'fs';
const newestWebm = allWebm
  .map(f => ({ f, mt: statSync(resolve(DIR, f)).mtimeMs }))
  .sort((a, b) => b.mt - a.mt)[0].f;

const rawWebm = resolve(DIR, newestWebm);
console.log(`✓ WebM captured: ${newestWebm}`);

// ── 4. Merge video + audio with ffmpeg ────────────────────────────────────────
console.log('\nMerging video + audio with ffmpeg…');

// Try to find ffmpeg: system, or local node_modules
let ffmpegBin = 'ffmpeg';
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
  // Try ffmpeg-static
  try {
    const { default: ffmpegPath } = await import('ffmpeg-static');
    ffmpegBin = ffmpegPath;
    console.log(`Using bundled ffmpeg: ${ffmpegBin}`);
  } catch {
    console.error('ffmpeg not found. Install it: brew install ffmpeg');
    // At least rename the webm so the user has the visual
    renameSync(rawWebm, OUT_WEBM);
    console.log(`Video (no audio) saved as: ${OUT_WEBM}`);
    process.exit(1);
  }
}

await new Promise((res, rej) => {
  const ff = spawn(ffmpegBin, [
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

// Cleanup
unlinkSync(rawWebm);
unlinkSync(TEMP_HTML);

console.log(`\n✓ Done! Video saved as:\n  ${OUT_MP4}`);
