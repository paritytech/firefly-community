#!/usr/bin/env bash
#
# Cocuyo Deployment Script
#
# Interactive deployment to Bulletin Chain with DotNS domain registration.
# Designed for third-party operators with guided prompts.
#
# Usage:
#   ./scripts/deploy.sh              # Interactive mode (recommended)
#   ./scripts/deploy.sh --help       # Show help
#
# Environment Variables (optional, will prompt if not set):
#   MNEMONIC        - 12-word seed phrase for signing transactions
#   DOTNS_DOMAIN    - Domain name (default: cocuyo.dot)
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/apps/web/dist"
DEFAULT_DOMAIN="cocuyo.dot"
PROJECT_NAME="Cocuyo"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

print_banner() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}                                                                  ${BLUE}║${NC}"
  echo -e "${BLUE}║${NC}   ${GREEN}${PROJECT_NAME} Deployment${NC}"
  echo -e "${BLUE}║${NC}   Deploy to Bulletin Chain with DotNS                            ${BLUE}║${NC}"
  echo -e "${BLUE}║${NC}                                                                  ${BLUE}║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

print_step() {
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  Step $1: $2${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

confirm() {
  local prompt="$1"
  local default="${2:-y}"

  if [[ "$default" == "y" ]]; then
    prompt="$prompt [Y/n]: "
  else
    prompt="$prompt [y/N]: "
  fi

  read -r -p "$prompt" response
  response=${response:-$default}
  [[ "$response" =~ ^[Yy]$ ]]
}

print_help() {
  echo "${PROJECT_NAME} Deployment Script"
  echo ""
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --help, -h        Show this help message"
  echo "  --skip-build      Skip the build step (use existing build)"
  echo "  --domain NAME     Set domain non-interactively"
  echo ""
  echo "Environment Variables:"
  echo "  MNEMONIC          Wallet mnemonic for deployment (will prompt if not set)"
  echo "  DOTNS_DOMAIN      DotNS domain (default: $DEFAULT_DOMAIN)"
  echo ""
  echo "Examples:"
  echo "  $0                                    # Interactive deployment"
  echo "  $0 --domain myapp.dot                 # Set domain, prompt for mnemonic"
  echo "  MNEMONIC=\"...\" $0                     # Use mnemonic from environment"
  echo ""
}

# -----------------------------------------------------------------------------
# Prerequisite Checks
# -----------------------------------------------------------------------------

check_prerequisites() {
  print_step "1" "Checking prerequisites"

  local missing=()

  # Check Node.js
  if command -v node &> /dev/null; then
    local node_version=$(node --version | sed 's/v//')
    local node_major=$(echo "$node_version" | cut -d. -f1)
    if [[ "$node_major" -ge 18 ]]; then
      log_success "Node.js v$node_version"
    else
      log_error "Node.js v$node_version (requires v18+)"
      missing+=("node")
    fi
  else
    log_error "Node.js not found"
    missing+=("node")
  fi

  # Check pnpm
  if command -v pnpm &> /dev/null; then
    log_success "pnpm $(pnpm --version)"
  else
    log_warn "pnpm not found - installing..."
    npm install -g pnpm@latest
    log_success "pnpm installed"
  fi

  # Check bulletin-deploy
  if command -v bulletin-deploy &> /dev/null; then
    log_success "bulletin-deploy $(bulletin-deploy --version 2>/dev/null || echo 'installed')"
  else
    log_warn "bulletin-deploy not found - installing..."
    npm install -g bulletin-deploy@latest
    log_success "bulletin-deploy installed"
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo ""
    log_error "Missing prerequisites: ${missing[*]}"
    echo ""
    echo "Please install:"
    echo "  - Node.js 18+: https://nodejs.org"
    echo ""
    exit 1
  fi

  log_success "All prerequisites met"
}

# -----------------------------------------------------------------------------
# Install Dependencies
# -----------------------------------------------------------------------------

install_dependencies() {
  print_step "2" "Installing dependencies"

  cd "$ROOT_DIR"

  if [[ -d "node_modules" ]]; then
    log_info "Dependencies found, verifying..."
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  else
    log_info "Installing dependencies (this may take a moment)..."
    pnpm install
  fi

  log_success "Dependencies ready"
}

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------

build_project() {
  print_step "3" "Building project"

  cd "$ROOT_DIR"

  log_info "Running build..."
  pnpm build

  if [[ ! -d "$DIST_DIR" ]]; then
    log_error "Build output not found at $DIST_DIR"
    exit 1
  fi

  log_success "Build complete"
  log_info "Output: $DIST_DIR"
}

# -----------------------------------------------------------------------------
# Deploy
# -----------------------------------------------------------------------------

deploy_to_bulletin() {
  print_step "4" "Deploying to Bulletin Chain"

  # Get domain
  local domain="${DOTNS_DOMAIN:-$DEFAULT_DOMAIN}"
  if [[ -z "${DOTNS_DOMAIN:-}" ]]; then
    echo ""
    log_info "Choose your DotNS domain"
    echo "  This will be your app's address: https://<domain>.dot.li"
    echo ""
    read -r -p "Enter domain [$domain]: " input_domain
    domain="${input_domain:-$domain}"
  fi

  # Ensure .dot suffix
  if [[ ! "$domain" =~ \.dot$ ]]; then
    domain="${domain}.dot"
  fi

  # Get mnemonic
  if [[ -z "${MNEMONIC:-}" ]]; then
    echo ""
    log_info "Enter your wallet mnemonic"
    echo "  This is used to sign the deployment transaction."
    echo "  Your mnemonic is NOT stored or logged."
    echo ""
    read -r -s -p "Mnemonic (hidden): " MNEMONIC
    echo ""

    if [[ -z "$MNEMONIC" ]]; then
      log_error "Mnemonic is required for deployment"
      exit 1
    fi
  fi

  echo ""
  log_info "Deployment configuration:"
  echo "  Domain: $domain"
  echo "  URL:    https://${domain%.dot}.dot.li"
  echo "  Source: $DIST_DIR"
  echo ""

  if ! confirm "Proceed with deployment?"; then
    log_info "Deployment cancelled"
    exit 0
  fi

  echo ""
  log_info "Deploying to Bulletin Chain..."
  log_warn "This may take a few minutes..."
  echo ""

  MNEMONIC="$MNEMONIC" bulletin-deploy "$DIST_DIR" "$domain"

  echo ""
  log_success "Deployment complete!"
  echo ""
  echo -e "  ${GREEN}Your app is live at:${NC} ${BLUE}https://${domain%.dot}.dot.li${NC}"
  echo ""
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
  local skip_build=false
  local domain_arg=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --help|-h)
        print_help
        exit 0
        ;;
      --skip-build)
        skip_build=true
        shift
        ;;
      --domain)
        domain_arg="$2"
        export DOTNS_DOMAIN="$2"
        shift 2
        ;;
      *)
        log_error "Unknown option: $1"
        print_help
        exit 1
        ;;
    esac
  done

  print_banner
  check_prerequisites
  install_dependencies

  if [[ "$skip_build" != "true" ]]; then
    build_project
  else
    log_info "Skipping build (--skip-build)"
    if [[ ! -d "$DIST_DIR" ]]; then
      log_error "No build found at $DIST_DIR. Run without --skip-build first."
      exit 1
    fi
  fi

  deploy_to_bulletin
}

main "$@"
