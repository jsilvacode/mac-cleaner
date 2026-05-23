#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/setup_apple_secrets.sh [owner/repo]
#
# This script prompts locally for Apple notarization values and uploads
# them as GitHub Actions repository secrets.

REPO="${1:-jsilvacode/mac-cleaner}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Falta comando requerido: $1" >&2
    exit 1
  fi
}

prompt_hidden() {
  local prompt="$1"
  local var_name="$2"
  local value
  read -r -s -p "$prompt" value
  echo
  printf -v "$var_name" "%s" "$value"
}

prompt_visible() {
  local prompt="$1"
  local var_name="$2"
  local value
  read -r -p "$prompt" value
  printf -v "$var_name" "%s" "$value"
}

require_cmd gh
require_cmd base64

echo "Repositorio objetivo: $REPO"
gh auth status >/dev/null

prompt_visible "Ruta local al certificado .p12: " CERT_PATH
if [[ ! -f "$CERT_PATH" ]]; then
  echo "No existe el archivo: $CERT_PATH" >&2
  exit 1
fi

prompt_hidden "Password del certificado .p12: " APPLE_CERTIFICATE_PASSWORD
prompt_visible "Identidad de firma (Developer ID Application: ...): " APPLE_SIGNING_IDENTITY
prompt_visible "Apple ID (correo): " APPLE_ID
prompt_hidden "Apple App-Specific Password: " APPLE_APP_SPECIFIC_PASSWORD
prompt_visible "Apple Team ID: " APPLE_TEAM_ID
prompt_hidden "Password para keychain temporal CI: " KEYCHAIN_PASSWORD

APPLE_CERTIFICATE_BASE64="$(base64 < "$CERT_PATH" | tr -d '\n')"

echo "Subiendo secrets a GitHub..."
gh secret set APPLE_CERTIFICATE_BASE64 -R "$REPO" -b "$APPLE_CERTIFICATE_BASE64"
gh secret set APPLE_CERTIFICATE_PASSWORD -R "$REPO" -b "$APPLE_CERTIFICATE_PASSWORD"
gh secret set APPLE_SIGNING_IDENTITY -R "$REPO" -b "$APPLE_SIGNING_IDENTITY"
gh secret set APPLE_ID -R "$REPO" -b "$APPLE_ID"
gh secret set APPLE_APP_SPECIFIC_PASSWORD -R "$REPO" -b "$APPLE_APP_SPECIFIC_PASSWORD"
gh secret set APPLE_TEAM_ID -R "$REPO" -b "$APPLE_TEAM_ID"
gh secret set KEYCHAIN_PASSWORD -R "$REPO" -b "$KEYCHAIN_PASSWORD"

echo "Secrets cargados correctamente en $REPO"
