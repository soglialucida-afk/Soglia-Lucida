#!/usr/bin/env python3
"""
Generate TikTok (1080x1920) and YouTube (1920x1080) MP4 lyric videos
for "Believe in People" by Soglia Lucida.

Speed optimisations:
  • color_grade applied ONCE at pre-process time, not per frame
  • vignette + grain merged into one float32 pass
  • cv2.resize used for fast downscale (falls back to PIL if not available)
  • Ken-Burns: pre-scaled big canvas, per-frame work = crop + optional resize
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import VideoClip, AudioFileClip

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

BASE_DIR   = '/Users/Mojca/Documents/Mojca/Believe_in_People_complete'
AUDIO_PATH = os.path.join(BASE_DIR, 'Believe_in_People.mp3')
FPS        = 24

# ── Timeline ──────────────────────────────────────────────────────────────────
TIMELINE = [
    [5,      13,    "Spread the green and neon branches,\nlet the breeze blow", False, 1],
    [13,     22,    "Sunlight won't leave from the sky,\nbirds will come back slow", False, 1],
    [22,     29,    "Flowers bud without a doubt,\nwinter's got to go", False, 2],
    [29,     35,    "Can we believe in people?\nLet the love show", True,  3],
    [40,     48,    "Trees will sway in harmony,\nlife will start to grow", False, 4],
    [48,     55,    "Colours brighten up the scene,\nwatch the magic flow", False, 5],
    [55,     62,    "Flowers bud without a doubt,\nwinter's got to go", False, 6],
    [62,     67,    "Can we believe in people?\nLet the love show", True,  3],
    [67,     88,    "Trees will sway in harmony,\nlife will start to grow", False, 7],
    [88,     96,    "Colours brighten up the scene,\nwatch the magic flow", False, 6],
    [96,    103,    "Flowers bud without a doubt,\nwinter's got to go", False, 7],
    [103,   108,    "Can we believe in people?\nLet the love show", True,  8],
    [108,   127.68, "",                                                   False, 9],
]

IMG_DURATIONS = {1:15, 2:18, 3:12, 4:20, 5:14, 6:16, 7:13, 8:17, 9:19}
IMG_REVERSE   = {1:False,2:True,3:False,4:True,5:False,6:True,7:False,8:True,9:False}
MAX_ZOOM = 1.15
MAX_PAN  = 0.02


# ── helpers ───────────────────────────────────────────────────────────────────

def get_slide_at(t):
    cur = 1
    for e in TIMELINE:
        if t >= e[0]:
            cur = e[4]
    return cur

def get_lyric_at(t):
    for e in TIMELINE:
        if t >= e[0] and t < e[1] and e[2]:
            return e
    return None

def get_font(size, italic=False):
    base = '/System/Library/Fonts/Supplemental/'
    paths = (
        [base+'Georgia Italic.ttf',
         base+'Times New Roman Italic.ttf',
         '/System/Library/Fonts/NewYorkItalic.ttf']
        if italic else
        [base+'Georgia.ttf',
         base+'Times New Roman.ttf',
         '/System/Library/Fonts/NewYork.ttf']
    )
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def fast_resize(arr, w, h):
    """Resize numpy RGB array to (h, w). Uses cv2 when available."""
    if HAS_CV2:
        return cv2.resize(arr, (w, h), interpolation=cv2.INTER_AREA)
    # NEAREST is ~8x faster than BILINEAR; quality fine for ≤15% downscale
    return np.array(Image.fromarray(arr).resize((w, h), Image.NEAREST))


def color_grade_arr(arr):
    """brightness×0.6, contrast×1.1 — returns float32."""
    a    = arr.astype(np.float32) * 0.6
    mean = a.mean()
    a    = mean + (a - mean) * 1.1
    return np.clip(a, 0, 255).astype(np.uint8)


def preprocess_images(raw, w, h):
    """
    Pre-scale and color-grade each source image ONCE.
    Returns {idx: ndarray(big_h, big_w, 3)} where big_w/big_h cover MAX_ZOOM.
    """
    big_w = int(w * MAX_ZOOM) + 4
    big_h = int(h * MAX_ZOOM) + 4
    out   = {}
    for idx, arr in raw.items():
        ih, iw = arr.shape[:2]
        scale  = max(big_w / iw, big_h / ih)
        rw, rh = int(iw * scale) + 2, int(ih * scale) + 2
        resized = fast_resize(arr, rw, rh)
        y0 = (rh - big_h) // 2
        x0 = (rw - big_w) // 2
        cropped = resized[y0:y0+big_h, x0:x0+big_w]
        out[idx] = color_grade_arr(cropped)   # ← grade happens once here
    print(f"    pre-processed canvas: {big_w}×{big_h} px, color-graded")
    return out, big_w, big_h


def make_vignette_mult(w, h):
    """
    Pre-compute float32 multiplier (h, w, 1) for the vignette.
    Multiply a frame by this to darken edges.
    """
    yy = np.linspace(-1, 1, h, dtype=np.float32)
    xx = np.linspace(-1, 1, w, dtype=np.float32)
    X, Y = np.meshgrid(xx, yy)
    dist  = np.sqrt(X**2 + Y**2)
    alpha = np.clip((dist - 0.40) / 0.60, 0, 1) ** 1.5 * (178/255)
    return (1.0 - alpha)[:, :, np.newaxis]   # (h, w, 1) float32


def make_grain_pool(h, w, n=8, strength=0.0):
    """8 pre-broadcoast grain patterns (h, w, 3) float32."""
    rng  = np.random.default_rng(42)
    mono = rng.normal(0, strength * 255, (n, h, w)).astype(np.float32)
    return np.stack([mono, mono, mono], axis=-1)   # (n, h, w, 3)


def kb_crop(img_big, t, idx, w, h, big_w, big_h):
    """Fast per-frame Ken-Burns crop from the pre-processed big canvas."""
    dur     = IMG_DURATIONS.get(idx, 15)
    reverse = IMG_REVERSE.get(idx, False)

    phase = (t / dur) % 2.0
    if phase > 1.0:
        phase = 2.0 - phase
    if reverse:
        phase = 1.0 - phase

    zoom = 1.0 + (MAX_ZOOM - 1.0) * phase   # 1.0 → 1.15
    px   = -MAX_PAN * phase
    py   = -MAX_PAN * phase

    # Crop size in big canvas that maps to exactly (w, h) at this zoom
    crop_w = int(w * MAX_ZOOM / zoom)
    crop_h = int(h * MAX_ZOOM / zoom)
    crop_w = min(crop_w, big_w)
    crop_h = min(crop_h, big_h)

    cx = big_w // 2 + int(px * crop_w)
    cy = big_h // 2 + int(py * crop_h)
    x0 = max(0, min(cx - crop_w // 2, big_w - crop_w))
    y0 = max(0, min(cy - crop_h // 2, big_h - crop_h))

    crop = img_big[y0:y0+crop_h, x0:x0+crop_w]

    if crop.shape[1] != w or crop.shape[0] != h:
        crop = fast_resize(crop, w, h)
    return crop


def apply_vignette_and_grain(frame, vig_mult, grain_pool, frame_idx):
    """One-pass float32: vignette multiply + grain add + clip."""
    g = grain_pool[frame_idx % len(grain_pool)]
    a = frame.astype(np.float32)
    a *= vig_mult
    a += g
    np.clip(a, 0, 255, out=a)
    return a.astype(np.uint8)


def draw_text_centered(draw, lines, cx, cy, font, fill, shadow, spacing=1.55):
    sizes = [draw.textbbox((0,0), ln, font=font) for ln in lines]
    lh    = max(b[3]-b[1] for b in sizes) if sizes else 0
    step  = int(lh * spacing)
    total = lh + step * (len(lines) - 1)
    y0    = cy - total // 2
    for i, ln in enumerate(lines):
        y = y0 + i * step
        draw.text((cx+2, y+2), ln, font=font, fill=shadow, anchor='mm')
        draw.text((cx,   y),   ln, font=font, fill=fill,   anchor='mm')


# ── renderer ──────────────────────────────────────────────────────────────────

def make_renderer(w, h, preproc, big_w, big_h, vig_mult, grain_pool, fonts):
    def make_frame(t):
        fi = int(t * FPS)
        si = get_slide_at(t)

        frame = kb_crop(preproc[si], t, si, w, h, big_w, big_h)
        frame = apply_vignette_and_grain(frame, vig_mult, grain_pool, fi)

        # ── text overlay ──────────────────────────────────────────────────
        pil     = Image.fromarray(frame)
        overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw    = ImageDraw.Draw(overlay)
        cx      = w // 2

        if t < 5.0:
            fi_ = min(1.0, t / 0.6)
            fo_ = min(1.0, (5.0 - t) / 0.6)
            a   = int(fi_ * fo_ * 255)
            draw.text((cx, h//2 - int(h*0.10)), "SOGLIA LUCIDA",
                      font=fonts['small'], fill=(196,163,90,a), anchor='mm')
            draw.text((cx, h//2), "Believe in People",
                      font=fonts['title'], fill=(245,240,232,a), anchor='mm')
            draw.text((cx, h//2 + int(h*0.07)), "Razburkan horizont",
                      font=fonts['coll'],  fill=(232,213,163,a), anchor='mm')
        else:
            lyric = get_lyric_at(t)
            if lyric:
                text, chorus, t0, t1 = lyric[2], lyric[3], lyric[0], lyric[1]
                fade = 0.8
                fi_  = min(1.0, (t - t0) / fade)
                fo_  = min(1.0, (t1 - t) / fade)
                a    = int(fi_ * fo_ * 255)
                if chorus:
                    fnt    = fonts['chorus']
                    color  = (232,213,163,a)
                    shadow = (0,0,0,int(a*0.8))
                else:
                    fnt    = fonts['lyrics']
                    color  = (255,255,255,a)
                    shadow = (0,0,0,int(a*0.8))
                draw_text_centered(draw, text.split('\n'),
                                   cx, int(h*0.44), fnt, color, shadow)

        pil = Image.alpha_composite(pil.convert('RGBA'), overlay)
        return np.array(pil.convert('RGB'))

    return make_frame


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"cv2 available: {HAS_CV2}")
    print("Loading audio…")
    ac = AudioFileClip(AUDIO_PATH)
    duration = ac.duration
    ac.close()
    print(f"  {duration:.2f}s  ({int(duration*FPS)} frames @ {FPS}fps)")

    print("Loading source images…")
    raw = {}
    for i in range(1, 10):
        raw[i] = np.array(Image.open(os.path.join(BASE_DIR, f'img{i}.jpg')).convert('RGB'))
    print("  OK")

    formats = [
        (1080, 1920, 'TikTok'),
        (1920, 1080, 'YouTube'),
    ]

    for w, h, label in formats:
        print(f"\n{'─'*54}")
        print(f"  {label}  {w}×{h}")
        print(f"{'─'*54}")

        preproc, big_w, big_h = preprocess_images(raw, w, h)
        vig_mult   = make_vignette_mult(w, h)
        grain_pool = make_grain_pool(h, w)

        scale = w / 1080
        fonts = {
            'lyrics': get_font(int(58 * scale)),
            'chorus': get_font(int(68 * scale), italic=True),
            'title':  get_font(int(88 * scale)),
            'small':  get_font(int(28 * scale)),
            'coll':   get_font(int(36 * scale), italic=True),
        }

        make_frame = make_renderer(w, h, preproc, big_w, big_h,
                                   vig_mult, grain_pool, fonts)

        # Quick speed estimate (10 frames)
        import time
        t0_ = time.time()
        for t_test in [i/FPS for i in range(0, 240, 24)]:
            make_frame(t_test)
        fps_est = 10 / (time.time() - t0_)
        eta_min = (duration * FPS) / fps_est / 60
        print(f"  Speed estimate: {fps_est:.1f} fps  →  ETA ≈ {eta_min:.0f} min")

        ac2   = AudioFileClip(AUDIO_PATH)
        video = VideoClip(make_frame, duration=duration).with_audio(ac2)
        out   = os.path.join(BASE_DIR, f'BelieveInPeople_{label}.mp4')

        video.write_videofile(out, fps=FPS, codec='libx264',
                              audio_codec='aac', preset='medium', logger='bar')
        video.close()
        ac2.close()
        print(f"\n  ✓  Saved → {out}")

    print("\nAll done!")


if __name__ == '__main__':
    main()
