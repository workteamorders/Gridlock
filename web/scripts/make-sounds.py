#!/usr/bin/env python3
"""Rebuilds public/audio/*.wav from the CC0 recordings listed in public/audio/CREDITS.md.

Usage: python3 scripts/make-sounds.py <dir that holds clones of the KenneyNL/Starter-Kit-* repositories>
Each clip is cut, faded at both ends, peak-normalised to -3 dBFS and written as 16-bit mono WAV at 32 kHz.
"""
import subprocess, sys, wave, pathlib
import numpy as np

SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'audio'
RATE = 32000

# name: (source file, start s, length s or None, fade-in s, fade-out s)
CLIPS = {
    'engine':  ('Starter-Kit-Racing/audio/engine.ogg', 1.0, 0.75, 0.02, 0.18),
    'impact':  ('Starter-Kit-Racing/audio/impact.ogg', 0.0, None, 0.0, 0.12),
    'skid':    ('Starter-Kit-Racing/audio/skid.ogg', 0.2, 0.9, 0.05, 0.3),
    'thud':    ('Starter-Kit-City-Builder/sounds/placement-c.ogg', 0.0, None, 0.0, 0.01),
    'tick':    ('Starter-Kit-Match-3/sounds/tile-swap.ogg', 0.0, None, 0.0, 0.01),
    'swish':   ('Starter-Kit-FPS/sounds/jump_c.ogg', 0.0, None, 0.0, 0.03),
    'whoosh':  ('Starter-Kit-FPS/sounds/jump_a.ogg', 0.0, None, 0.0, 0.05),
    'coin':    ('Starter-Kit-3D-Platformer/sounds/coin.ogg', 0.0, None, 0.0, 0.03),
}

for name, (rel, start, length, fin, fout) in CLIPS.items():
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start)] + (['-t', str(length)] if length else []) + ['-i', str(SRC / rel), '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-']
    x = np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).copy()
    n = len(x)
    if fin: k = int(fin * RATE); x[:k] *= np.linspace(0, 1, k)
    if fout: k = min(n, int(fout * RATE)); x[-k:] *= np.linspace(1, 0, k)
    x *= 0.708 / max(1e-6, float(np.abs(x).max()))
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm.tobytes())
    print(f'{name}.wav {n / RATE:.2f}s {len(pcm) * 2 // 1024} KB')
