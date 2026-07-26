#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
waybar_config="${XDG_CONFIG_HOME:-$HOME/.config}/waybar/config.jsonc"
waybar_style="${XDG_CONFIG_HOME:-$HOME/.config}/waybar/style.css"
purge="no"

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
    --purge)
      purge="yes"
      shift
      ;;
    -h|--help)
      echo "Usage: ./uninstall.sh [--waybar-config PATH] [--waybar-style PATH] [--purge]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

node "$project_root/scripts/configure-waybar.mjs" \
  uninstall "$waybar_config" "$waybar_style"

installed_link="$HOME/.local/bin/tickbar"
if [[ -L "$installed_link" && "$(readlink -f "$installed_link")" == "$project_root/bin/tickbar" ]]; then
  unlink "$installed_link"
fi

font_directory="${XDG_DATA_HOME:-$HOME/.local/share}/fonts/ticktick-waybar"
font_file="$font_directory/SimpleIcons.ttf"
if [[ -f "$font_file" ]]; then
  rm "$font_file"
  rmdir "$font_directory" 2>/dev/null || true
  fc-cache -f >/dev/null
fi

if [[ "$purge" == "yes" ]]; then
  "$project_root/node_modules/.bin/ticktick" auth logout 2>/dev/null || true
  rm -r "${XDG_CACHE_HOME:-$HOME/.cache}/ticktick-waybar" 2>/dev/null || true
  rm -r "${XDG_CONFIG_HOME:-$HOME/.config}/ticktick-waybar" 2>/dev/null || true
  rm -r "${XDG_STATE_HOME:-$HOME/.local/state}/ticktick-waybar" 2>/dev/null || true
fi

if command -v omarchy >/dev/null 2>&1; then
  omarchy restart waybar
else
  pkill -SIGUSR2 waybar 2>/dev/null || true
fi

echo "TickTick Waybar removed. Backups remain beside the Waybar config."
