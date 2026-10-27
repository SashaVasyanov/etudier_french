#!/usr/bin/env python3
"""Shrink the word illustrations that ship with the app.

The photos in public/generated-word-images were saved as JPEG/PNG at up to
600x853, but the app never shows them larger than ~360 CSS px. This script
re-encodes each one as WebP with the long side capped at MAX_SIDE, moves the
original to assets-src/word-images/ (kept as the source, not bundled), and
points public/data/word_images.json at the new files.

Safe to stop and run again: every step checks what is already done.

    python3 scripts/optimize_word_images.py              # convert everything
    python3 scripts/optimize_word_images.py --limit 300  # convert in chunks
    python3 scripts/optimize_word_images.py --check      # report only
"""
from __future__ import annotations

import json
import os
import shutil
import sys

from PIL import Image

MAX_SIDE = 560
QUALITY = 70

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, 'public', 'generated-word-images')
ORIGINALS = os.path.join(ROOT, 'assets-src', 'word-images')
MANIFEST = os.path.join(ROOT, 'public', 'data', 'word_images.json')
PUBLIC_PREFIX = '/generated-word-images/'
SOURCE_EXTENSIONS = ('.jpg', '.jpeg', '.png')


def is_small_webp(path: str) -> bool:
    if not os.path.exists(path):
        return False
    with Image.open(path) as image:
        return max(image.size) <= MAX_SIDE


def encode(source: str, target: str) -> None:
    temporary = target + '.tmp'
    with Image.open(source) as image:
        has_alpha = image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info)
        image = image.convert('RGBA' if has_alpha else 'RGB')
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        image.save(temporary, 'WEBP', quality=QUALITY, method=6)
    os.replace(temporary, target)


def pending(names: list[str]) -> list[str]:
    result = []
    for name in names:
        path = os.path.join(IMAGES, name)
        if name.lower().endswith(SOURCE_EXTENSIONS):
            result.append(name)
        elif name.lower().endswith('.webp') and not is_small_webp(path):
            result.append(name)
    return result


def convert(name: str) -> None:
    source = os.path.join(IMAGES, name)
    stem, extension = os.path.splitext(name)
    target = os.path.join(IMAGES, stem + '.webp')
    kept = os.path.join(ORIGINALS, name)
    if extension.lower() == '.webp':
        # An oversized WebP: keep a copy of the original, then shrink in place.
        if not os.path.exists(kept):
            shutil.copy2(source, kept)
        encode(kept, target)
        return
    # Write the WebP first, then move the original out of public/.
    if not is_small_webp(target):
        encode(source, target)
    shutil.move(source, kept)


def update_manifest() -> int:
    with open(MANIFEST, encoding='utf-8') as handle:
        manifest = json.load(handle)
    updated = 0
    for entry in manifest.values():
        if not isinstance(entry, dict):
            continue
        for key, value in list(entry.items()):
            if not (isinstance(value, str) and value.startswith(PUBLIC_PREFIX)):
                continue
            name = value[len(PUBLIC_PREFIX):]
            stem, extension = os.path.splitext(name)
            if extension.lower() not in SOURCE_EXTENSIONS:
                continue
            if os.path.exists(os.path.join(IMAGES, stem + '.webp')) and not os.path.exists(os.path.join(IMAGES, name)):
                entry[key] = PUBLIC_PREFIX + stem + '.webp'
                updated += 1
    if updated:
        with open(MANIFEST, 'w', encoding='utf-8') as handle:
            json.dump(manifest, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
    return updated


def folder_size() -> float:
    return sum(os.path.getsize(os.path.join(IMAGES, name)) for name in os.listdir(IMAGES)) / 1e6


def main() -> int:
    limit = None
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])
    names = sorted(name for name in os.listdir(IMAGES) if not name.endswith('.tmp'))
    todo = pending(names)
    print(f'{len(names)} files, {folder_size():.1f} MB; {len(todo)} to convert')
    if '--check' in sys.argv:
        return 1 if todo else 0

    os.makedirs(ORIGINALS, exist_ok=True)
    for index, name in enumerate(todo[:limit], 1):
        convert(name)
        if index % 100 == 0:
            print(f'  {index}/{len(todo[:limit])}', flush=True)

    updated = update_manifest()
    left = len(pending(sorted(os.listdir(IMAGES))))
    print(f'Now {folder_size():.1f} MB; {updated} manifest paths updated; {left} left')
    return 0


if __name__ == '__main__':
    sys.exit(main())
