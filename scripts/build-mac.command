#!/bin/zsh -l
# Builds the macOS app and installs it into /Applications.
# Double-click in Finder, or run: ./scripts/build-mac.command
# The previous /Applications/étudier.app is moved to the Trash (recoverable).
# Learning progress is not touched: it lives in the WebView data of the
# bundle id com.etudier.french, not inside the .app.

set -u
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" >/dev/null 2>&1
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

cd "$(dirname "$0")/.." || exit 1
LOG="scripts/build-mac.log"
STATUS="scripts/build-mac.status"
echo "running" > "$STATUS"
exec > >(tee "$LOG") 2>&1

fail() { echo "\n✗ $1"; echo "failed: $1" > "$STATUS"; exit 1; }

echo "== étudier: сборка macOS-приложения ($(date '+%Y-%m-%d %H:%M')) =="
command -v npm >/dev/null || fail "npm не найден"
command -v cargo >/dev/null || fail "cargo не найден (установите Rust через rustup)"

echo "\n— Тесты"
npm test || fail "тесты не прошли"

echo "\n— Сборка (tauri build --bundles app)"
# Only the .app: the DMG step needs extra Finder permissions and is not used.
npm run tauri -- build --bundles app || fail "сборка не удалась"

APP="src-tauri/target/release/bundle/macos/étudier.app"
[ -d "$APP" ] || fail "не найден $APP"

echo "\n— Размер"
node scripts/check-size.mjs "$APP"

echo "\n— Установка в /Applications"
if [ -d "/Applications/étudier.app" ]; then
  mv "/Applications/étudier.app" "$HOME/.Trash/étudier-$(date '+%Y%m%d-%H%M%S').app" || fail "не удалось убрать старую версию"
fi
ditto "$APP" "/Applications/étudier.app" || fail "не удалось скопировать приложение"

VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "/Applications/étudier.app/Contents/Info.plist" 2>/dev/null)
echo "\n✓ Готово: /Applications/étudier.app, версия $VERSION"
echo "ok $VERSION" > "$STATUS"
