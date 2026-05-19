#!/bin/bash
# ============================================================
# mac_cleaner_v2.sh — Motor seguro de limpieza para macOS
# Uso:
#   ./mac_cleaner_v2.sh scan [--json]
#   ./mac_cleaner_v2.sh dry-run [--json]
#   ./mac_cleaner_v2.sh clean [--yes]
#   ./mac_cleaner_v2.sh large-files [500M]
#   ./mac_cleaner_v2.sh top-dirs
# ============================================================

set -u

VERSION="2.1.0"
APP_NAME="mac_cleaner_tauri_agent"
LOG_DIR="${HOME}/Library/Logs/${APP_NAME}"
LOG_FILE="${LOG_DIR}/run.log"
LOG_ENABLED="false"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

if mkdir -p "$LOG_DIR" 2>/dev/null && touch "$LOG_FILE" 2>/dev/null; then
  LOG_ENABLED="true"
fi

log_file() {
  if [ "$LOG_ENABLED" != "true" ]; then
    return 0
  fi
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE" 2>/dev/null || true
}

log_info()  { printf "%b  →%b %s\n" "$CYAN" "$RESET" "$1"; log_file "INFO: $1"; }
log_ok()    { printf "%b  ✓%b %s\n" "$GREEN" "$RESET" "$1"; log_file "OK: $1"; }
log_warn()  { printf "%b  ⚠%b %s\n" "$YELLOW" "$RESET" "$1"; log_file "WARN: $1"; }
log_error() { printf "%b  ✗%b %s\n" "$RED" "$RESET" "$1"; log_file "ERROR: $1"; }

separator() { printf "%b────────────────────────────────────────%b\n" "$BLUE" "$RESET"; }

usage() {
  cat <<USAGE
${APP_NAME} ${VERSION}

Uso:
  $0 scan [--json]          Escanea espacio recuperable sin borrar nada
  $0 dry-run [--json]       Lista elementos que serían eliminados
  $0 clean [--yes]          Ejecuta limpieza segura (sin prompts con --yes)
  $0 large-files [500M]     Lista archivos grandes en HOME
  $0 top-dirs               Muestra carpetas más pesadas en HOME
  $0 help                   Muestra esta ayuda

Notas:
  - No usa sudo.
  - No limpia rutas críticas del sistema.
  - No sigue symlinks.
  - Solo borra elementos antiguos según política interna.
USAGE
}

human_size_kb() {
  local kb="${1:-0}"
  awk -v kb="$kb" 'BEGIN {
    if (kb >= 1073741824) printf "%.2f TB", kb/1073741824;
    else if (kb >= 1048576) printf "%.2f GB", kb/1048576;
    else if (kb >= 1024) printf "%.2f MB", kb/1024;
    else printf "%d KB", kb;
  }'
}

path_size_kb() {
  local path="$1"
  if [ -e "$path" ]; then
    local kb
    kb="$(du -sk "$path" 2>/dev/null | awk 'NR==1 {print $1}')"
    if [ -n "$kb" ]; then
      printf '%s\n' "$kb"
    else
      printf '0\n'
    fi
  else
    printf '0\n'
  fi
}

json_escape() {
  # Escapado básico suficiente para rutas y nombres simples en macOS.
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

confirm() {
  local prompt="$1"
  printf "%b  ¿%s? [s/N] %b" "$YELLOW" "$prompt" "$RESET"
  read -r answer
  case "$answer" in
    s|S|si|SI|sí|SÍ) return 0 ;;
    *) return 1 ;;
  esac
}

# Catálogo: id|label|path|minimum_age_days|risk
catalog() {
  cat <<CATALOG
user_cache|Caché de usuario|${HOME}/Library/Caches|7|medio
user_logs|Logs de usuario|${HOME}/Library/Logs|14|bajo
trash|Papelera de usuario|${HOME}/.Trash|7|medio
tmp|Temporales /tmp|/tmp|1|medio
CATALOG
}

is_allowed_path() {
  local target="$1"
  case "$target" in
    "$HOME/Library/Caches"|"$HOME/Library/Logs"|"$HOME/.Trash"|/tmp)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

validate_target() {
  local target="$1"

  if [ -z "$target" ] || [ "$target" = "/" ]; then
    log_error "Ruta inválida: '$target'"
    return 1
  fi

  if ! is_allowed_path "$target"; then
    log_error "Ruta fuera de whitelist: $target"
    return 1
  fi

  if [ -L "$target" ]; then
    log_error "La ruta principal es un symlink y no se procesará: $target"
    return 1
  fi

  if [ ! -d "$target" ]; then
    log_warn "Ruta no disponible: $target"
    return 1
  fi

  return 0
}

estimated_cleanable_kb() {
  local target="$1"
  local age_days="$2"
  local total=0

  validate_target "$target" >/dev/null 2>&1 || { printf '0\n'; return; }

  while IFS= read -r -d '' item; do
    if [ -L "$item" ]; then
      continue
    fi
    size=$(path_size_kb "$item")
    total=$((total + size))
  done < <(find "$target" -mindepth 1 -maxdepth 1 -mtime +"$age_days" ! -type l -print0 2>/dev/null)

  printf '%s\n' "$total"
}

print_scan_table() {
  separator
  printf "%bEscaneo seguro de limpieza macOS%b\n" "$BOLD" "$RESET"
  separator
  printf "%-16s %-18s %-10s %-10s %s\n" "Categoría" "Estimado" "Riesgo" "Antigüedad" "Ruta"
  separator

  total=0
  while IFS="|" read -r id label path age risk; do
    kb=$(estimated_cleanable_kb "$path" "$age")
    total=$((total + kb))
    printf "%-16s %-18s %-10s %-10s %s\n" "$id" "$(human_size_kb "$kb")" "$risk" "+${age} días" "$path"
  done < <(catalog)

  separator
  log_info "Ejecuta '$0 dry-run' para ver elementos específicos."
}

print_scan_json() {
  printf '{"version":"%s","mode":"scan","items":[' "$VERSION"
  first=1
  total=0

  while IFS="|" read -r id label path age risk; do
    kb=$(estimated_cleanable_kb "$path" "$age")
    total=$((total + kb))
    if [ "$first" -eq 0 ]; then printf ','; fi
    first=0
    printf '{"id":"%s","label":"%s","path":"%s","age_days":%s,"risk":"%s","estimated_kb":%s,"estimated_human":"%s"}' \
      "$(json_escape "$id")" \
      "$(json_escape "$label")" \
      "$(json_escape "$path")" \
      "$age" \
      "$(json_escape "$risk")" \
      "$kb" \
      "$(json_escape "$(human_size_kb "$kb")")"
  done < <(catalog)

  printf ']}\n'
}

list_candidates() {
  local target="$1"
  local age_days="$2"

  validate_target "$target" >/dev/null 2>&1 || return 0
  find "$target" -mindepth 1 -maxdepth 1 -mtime +"$age_days" ! -type l -print0 2>/dev/null
}

run_dry_run() {
  local json="${1:-false}"

  if [ "$json" = "true" ]; then
    printf '{"version":"%s","mode":"dry-run","candidates":[' "$VERSION"
    first=1
    while IFS="|" read -r id label path age risk; do
      while IFS= read -r -d '' item; do
        kb=$(path_size_kb "$item")
        if [ "$first" -eq 0 ]; then printf ','; fi
        first=0
        printf '{"category":"%s","path":"%s","size_kb":%s,"size_human":"%s","risk":"%s"}' \
          "$(json_escape "$id")" \
          "$(json_escape "$item")" \
          "$kb" \
          "$(json_escape "$(human_size_kb "$kb")")" \
          "$(json_escape "$risk")"
      done < <(list_candidates "$path" "$age")
    done < <(catalog)
    printf ']}\n'
    return 0
  fi

  separator
  printf "%bDry-run: elementos que serían eliminados%b\n" "$BOLD" "$RESET"
  separator

  found=0
  while IFS="|" read -r id label path age risk; do
    printf "\n%b[%s] %s | riesgo: %s | antigüedad: +%s días%b\n" "$CYAN" "$id" "$label" "$risk" "$age" "$RESET"
    while IFS= read -r -d '' item; do
      found=1
      kb=$(path_size_kb "$item")
      printf "  %10s  %s\n" "$(human_size_kb "$kb")" "$item"
    done < <(list_candidates "$path" "$age")
  done < <(catalog)

  printf "\n"
  log_info "Dry-run completado. No se eliminó ningún archivo."
}

run_clean() {
  local auto_confirm="${1:-false}"
  separator
  printf "%bLimpieza segura macOS%b\n" "$BOLD" "$RESET"
  separator
  log_warn "Se eliminarán solo elementos antiguos dentro de rutas permitidas."
  log_warn "No se usarán permisos sudo. No se tocarán rutas críticas del sistema."

  before_total=0
  after_total=0

  while IFS="|" read -r id label path age risk; do
    kb=$(estimated_cleanable_kb "$path" "$age")
    printf "\n%b[%s] %s%b\n" "$CYAN" "$id" "$label" "$RESET"
    printf "  Ruta: %s\n" "$path"
    printf "  Riesgo: %s\n" "$risk"
    printf "  Estimado: %s\n" "$(human_size_kb "$kb")"
    printf "  Regla: elementos con más de %s días\n" "$age"

    if [ "$kb" -le 0 ]; then
      log_info "No hay elementos candidatos."
      continue
    fi

    if [ "$auto_confirm" = "true" ] || confirm "Limpiar esta categoría"; then
      category_before=$(path_size_kb "$path")
      while IFS= read -r -d '' item; do
        if [ -L "$item" ]; then
          log_warn "Omitido symlink: $item"
          continue
        fi
        rm -rf "$item" 2>/dev/null || log_warn "No se pudo eliminar: $item"
      done < <(list_candidates "$path" "$age")
      category_after=$(path_size_kb "$path")
      freed=$((category_before - category_after))
      if [ "$freed" -lt 0 ]; then freed=0; fi
      log_ok "Categoría procesada. Espacio recuperado aproximado: $(human_size_kb "$freed")"
    else
      log_warn "Categoría omitida."
    fi
  done < <(catalog)

  separator
  log_ok "Limpieza finalizada. Revisa el log en: $LOG_FILE"
}

large_files() {
  local threshold="${1:-500M}"
  separator
  printf "%bArchivos grandes en HOME%b\n" "$BOLD" "$RESET"
  separator
  log_info "Buscando archivos mayores a ${threshold}. No se eliminará nada."

  find "$HOME" -type f -size +"$threshold" -print0 2>/dev/null | while IFS= read -r -d '' file; do
    kb=$(path_size_kb "$file")
    printf "%10s  %s\n" "$(human_size_kb "$kb")" "$file"
  done
}

top_dirs() {
  separator
  printf "%bTop carpetas más pesadas en HOME%b\n" "$BOLD" "$RESET"
  separator
  du -sk "$HOME"/* 2>/dev/null | sort -rn | head -10 | while read -r kb path; do
    printf "%10s  %s\n" "$(human_size_kb "$kb")" "$path"
  done
}

main() {
  local command="${1:-help}"
  local flag="${2:-}"

  case "$command" in
    scan)
      if [ "$flag" = "--json" ]; then print_scan_json; else print_scan_table; fi
      ;;
    dry-run)
      if [ "$flag" = "--json" ]; then run_dry_run true; else run_dry_run false; fi
      ;;
    clean)
      if [ "$flag" = "--yes" ]; then
        run_clean true
      else
        run_clean false
      fi
      ;;
    large-files)
      large_files "${2:-500M}"
      ;;
    top-dirs)
      top_dirs
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      log_error "Comando no reconocido: $command"
      usage
      exit 1
      ;;
  esac
}

main "$@"
