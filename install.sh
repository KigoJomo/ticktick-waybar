#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
waybar_config="${XDG_CONFIG_HOME:-$HOME/.config}/waybar/config.jsonc"
waybar_style="${XDG_CONFIG_HOME:-$HOME/.config}/waybar/style.css"
position="center"
authenticate="yes"

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

Options:
  --waybar-config PATH   Waybar JSONC config
  --waybar-style PATH    Waybar CSS file
  --position LOCATION    left, center or right (default: center)
  --no-auth              Skip browser OAuth
  -h, --help             Show this help
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --waybar-config)
      waybar_config="${2:?Missing path after --waybar-config}"
      shift 2
      ;;
    --waybar-style)
      waybar_style="${2:?Missing path after --waybar-style}"
      shift 2
      ;;
    --position)
      position="${2:?Missing location after --position}"
      shift 2
      ;;
    --no-auth)
      authenticate="no"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$position" in
  left|center|right) ;;
  *)
    echo "--position must be left, center or right" >&2
    exit 2
    ;;
esac

for command in node npm waybar walker fc-cache; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

node -e 'const major = Number(process.versions.node.split(".")[0]); process.exit(major >= 20 ? 0 : 1)' || {
  echo "Node.js 20 or newer is required" >&2
  exit 1
}

if [[ ! -f "$waybar_config" || ! -f "$waybar_style" ]]; then
  echo "Waybar config or style file not found. Pass explicit paths if needed." >&2
  exit 1
fi

echo "Installing locked dependencies..."
npm ci --omit=dev --prefix "$project_root"

mkdir -p "$HOME/.local/bin"
ln -sfn "$project_root/bin/tickbar" "$HOME/.local/bin/tickbar"
font_directory="${XDG_DATA_HOME:-$HOME/.local/share}/fonts/ticktick-waybar"
install -Dm644 \
  "$project_root/node_modules/simple-icons-font/font/SimpleIcons-Fit.ttf" \
  "$font_directory/SimpleIcons.ttf"
fc-cache -f "$font_directory" >/dev/null

node "$project_root/scripts/configure-waybar.mjs" \
  install "$waybar_config" "$waybar_style" "$HOME/.local/bin/tickbar" "$position"

if [[ "$authenticate" == "yes" ]]; then
  "$HOME/.local/bin/tickbar" auth
fi

if command -v omarchy >/dev/null 2>&1; then
  omarchy restart waybar
else
  pkill -SIGUSR2 waybar 2>/dev/null || true
fi

echo
echo "TickTick Waybar installed."
echo "Left-click completes tasks, right-click adds to Inbox, middle-click opens Today."
