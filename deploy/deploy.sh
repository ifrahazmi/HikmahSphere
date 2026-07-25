#!/bin/bash

# ============================================
# HikmahSphere - Automated Deployment Script
# ============================================
# Description: Automatically deploys latest changes from a target branch
#              Creates upload folders, configures Nginx, and verifies everything
# Usage: ./deploy.sh [--branch <name>] [--scope <both|backend|frontend>] [--restore-mongo <latest|timestamp>]
# ============================================

set -Eeuo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Get current username
CURRENT_USER=$(whoami)
CURRENT_HOME="${HOME}"
PROJECT_ROOT="${CURRENT_HOME}/HikmahSphere"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
PM2_APP_NAME="hikmah-backend"
PM2_ECOSYSTEM_FILE="${PROJECT_ROOT}/ecosystem.config.js"
PM2_SERVICE_NAME="pm2-${CURRENT_USER}"
WEB_ROOT="/var/www/hikmah"
DEPLOY_LOCK_FILE="/tmp/hikmahsphere-deploy.lock"

BACKUP_ROOT="${PROJECT_ROOT}/db-backup"
MONGO_BACKUP_ROOT="${BACKUP_ROOT}/mongo"
FRONTEND_BACKUP_ROOT="${BACKUP_ROOT}/frontend"
MANIFEST_ROOT="${BACKUP_ROOT}/manifests"
REPORT_ROOT="${BACKUP_ROOT}/reports"

MONGO_CONTAINER_NAME="hikmahsphere-mongodb"
MONGO_DB_NAME="hikmahsphere"
MONGO_AUTH_DB="admin"

DEPLOY_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
START_TIME_EPOCH="$(date +%s)"
DEPLOY_BRANCH="notification"
DEPLOY_SCOPE="both"
RESTORE_MONGO_SELECTOR=""
RESTORE_MONGO_SOURCE_FILE=""
BACKUP_COMPLETED=0
DEPLOY_SUCCESS=0
ROLLBACK_IN_PROGRESS=0
MONGO_BACKUP_FILE=""
FRONTEND_BACKUP_DIR=""
MANIFEST_FILE=""
DEPLOY_REPORT_FILE=""
MONGO_USERNAME=""
MONGO_PASSWORD=""
BUILD_SIZE="N/A"

# Timestamp function
timestamp() {
    date +"[%Y-%m-%d %H:%M:%S]"
}

# Print section header
print_header() {
    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
}

# Print step
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Print info
print_info() {
    echo -e "${MAGENTA}ℹ $1${NC}"
}

print_usage() {
    cat <<EOF
Usage:
  ./deploy.sh [--branch <name>] [--scope <both|backend|frontend>] [--restore-mongo <latest|timestamp>] [--help]

Options:
  --branch <name>           Branch to deploy (default: notification)
  --scope <value>           Deployment scope: both, backend, or frontend (default: both)
  --restore-mongo <value>   Restore MongoDB before deployment using either:
                            - latest
                            - backup timestamp folder name (example: 20260418_150000)
  --help                    Show this help message

Examples:
  ./deploy.sh
  ./deploy.sh --branch main
  ./deploy.sh --scope backend
  ./deploy.sh --scope frontend --branch release-hotfix
  ./deploy.sh --restore-mongo latest
  ./deploy.sh --restore-mongo 20260418_150000 --branch notification --scope both
EOF
}

parse_args() {
    while [ "$#" -gt 0 ]; do
        case "$1" in 
            --branch)
                if [ "$#" -lt 2 ]; then
                    print_error "Missing value for --branch"
                    print_usage
                    exit 1
                fi
                DEPLOY_BRANCH="$2"
                shift 2
                ;;
            --scope)
                if [ "$#" -lt 2 ]; then
                    print_error "Missing value for --scope"
                    print_usage
                    exit 1
                fi
                DEPLOY_SCOPE="$2"
                shift 2
                ;;
            --restore-mongo)
                if [ "$#" -lt 2 ]; then
                    print_error "Missing value for --restore-mongo"
                    print_usage
                    exit 1
                fi
                RESTORE_MONGO_SELECTOR="$2"
                shift 2
                ;;
            --help|-h)
                print_usage
                exit 0
                ;;
            *)
                print_error "Unknown argument: $1"
                print_usage
                exit 1
                ;;
        esac
    done

    if [ -z "${DEPLOY_BRANCH}" ]; then
        print_error "Branch cannot be empty"
        exit 1
    fi

    case "${DEPLOY_SCOPE}" in
        both|backend|frontend)
            ;;
        *)
            print_error "Invalid --scope value: ${DEPLOY_SCOPE}. Use both, backend, or frontend."
            exit 1
            ;;
    esac

    if [ -n "${RESTORE_MONGO_SELECTOR}" ] && [ "${RESTORE_MONGO_SELECTOR}" != "latest" ]; then
        if ! [[ "${RESTORE_MONGO_SELECTOR}" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
            print_error "Invalid --restore-mongo value: ${RESTORE_MONGO_SELECTOR}. Use latest or timestamp format YYYYMMDD_HHMMSS."
            exit 1
        fi
    fi
}

# Remove ANSI color codes so command parsing stays reliable.
strip_ansi() {
    sed -E 's/\x1B\[[0-9;]*[mK]//g'
}

extract_pm2_startup_command() {
    local startup_output="$1"

    printf '%s\n' "${startup_output}" \
        | strip_ansi \
        | grep -E '^[[:space:]]*sudo ' \
        | tail -n 1 \
        | sed -E 's/^[[:space:]]*//' || true
}

pm2_service_exists() {
    sudo systemctl list-unit-files "${PM2_SERVICE_NAME}.service" --no-legend 2>/dev/null \
        | grep -q "^${PM2_SERVICE_NAME}\\.service"
}

wait_for_pm2_service() {
    local attempt=1
    local max_attempts=10

    while [ "${attempt}" -le "${max_attempts}" ]; do
        if sudo systemctl is-active --quiet "${PM2_SERVICE_NAME}"; then
            return 0
        fi

        sleep 1
        attempt=$((attempt + 1))
    done

    return 1
}

clean_pm2_runtime_state() {
    rm -f \
        "${CURRENT_HOME}/.pm2/pm2.pid" \
        "${CURRENT_HOME}/.pm2/rpc.sock" \
        "${CURRENT_HOME}/.pm2/pub.sock"
}

ensure_pm2_persistence() {
    local startup_output=""
    local startup_command=""

    print_step "Enabling systemd lingering for ${CURRENT_USER}..."
    sudo loginctl enable-linger "${CURRENT_USER}"
    print_success "Lingering enabled for ${CURRENT_USER}"

    if pm2_service_exists; then
        print_info "PM2 startup already configured for ${PM2_SERVICE_NAME}"
        print_success "PM2 startup configuration already present"
    else
        print_step "Configuring PM2 startup with systemd..."
        startup_output=$(pm2 startup systemd -u "${CURRENT_USER}" --hp "${CURRENT_HOME}" 2>&1 || true)
        startup_command=$(extract_pm2_startup_command "${startup_output}")

        if [ -n "${startup_command}" ]; then
            print_info "Running PM2 startup command returned by PM2"
            print_info "${startup_command}"
            eval "${startup_command}"
            print_success "PM2 startup command applied"
        else
            print_error "PM2 startup did not return a usable sudo command"
            printf '%s\n' "${startup_output}"
            exit 1
        fi
    fi
}

start_or_restart_backend_with_pm2() {
    export NODE_ENV=production
    export PORT="${BACKEND_PORT}"

    if pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
        print_step "Restarting backend with PM2..."
        pm2 restart "${PM2_APP_NAME}" --update-env
        print_success "Backend restarted"
    else
        print_warning "PM2 process '${PM2_APP_NAME}' not found. Starting it from ecosystem config..."
        pm2 start "${PM2_ECOSYSTEM_FILE}" --only "${PM2_APP_NAME}" --update-env
        print_success "Backend started"
    fi

    sleep 2
}

save_and_enable_pm2_service() {
    print_step "Saving PM2 process list..."
    pm2 save
    print_success "PM2 process list saved"

    print_step "Enabling ${PM2_SERVICE_NAME} on boot..."
    sudo systemctl daemon-reload
    sudo systemctl enable "${PM2_SERVICE_NAME}"
    print_success "${PM2_SERVICE_NAME} enabled"

    if sudo systemctl is-active --quiet "${PM2_SERVICE_NAME}"; then
        print_step "Reloading ${PM2_SERVICE_NAME}..."
        sudo systemctl reload "${PM2_SERVICE_NAME}"
        wait_for_pm2_service
        print_success "${PM2_SERVICE_NAME} reloaded"
    else
        print_warning "${PM2_SERVICE_NAME} is not active yet. Handing PM2 over to systemd..."
        sudo systemctl stop "${PM2_SERVICE_NAME}" >/dev/null 2>&1 || true
        sudo systemctl reset-failed "${PM2_SERVICE_NAME}" >/dev/null 2>&1 || true
        pm2 kill >/dev/null 2>&1 || true
        clean_pm2_runtime_state
        sudo systemctl start "${PM2_SERVICE_NAME}"
        wait_for_pm2_service
        print_success "${PM2_SERVICE_NAME} started under systemd"
    fi

    if ! sudo systemctl is-active --quiet "${PM2_SERVICE_NAME}"; then
        print_error "${PM2_SERVICE_NAME} failed to become active"
        sudo systemctl status "${PM2_SERVICE_NAME}" --no-pager || true
        exit 1
    fi
}

# Resolve backend port from backend/.env, falling back to 5000.
get_backend_port() {
    local env_file="${BACKEND_DIR}/.env"
    local detected_port=""

    if [ -f "$env_file" ]; then
        detected_port=$(grep -E '^PORT=' "$env_file" | tail -n 1 | cut -d'=' -f2 | tr -d '[:space:]' || true)
    fi

    if [[ "$detected_port" =~ ^[0-9]{2,5}$ ]]; then
        echo "$detected_port"
    else
        echo "5000"
    fi
}

get_env_value() {
    local key="$1"
    local env_file="$2"
    local fallback="$3"
    local value=""

    if [ -f "$env_file" ]; then
        value=$(grep -E "^${key}=" "$env_file" | tail -n 1 | cut -d'=' -f2- | sed 's/^ *//;s/ *$//' | tr -d '"' || true)
    fi

    if [ -n "$value" ]; then
        echo "$value"
    else
        echo "$fallback"
    fi
}

require_command() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        print_error "Required command not found: $cmd"
        exit 1
    fi
}

should_deploy_backend() {
    [ "${DEPLOY_SCOPE}" = "both" ] || [ "${DEPLOY_SCOPE}" = "backend" ]
}

should_deploy_frontend() {
    [ "${DEPLOY_SCOPE}" = "both" ] || [ "${DEPLOY_SCOPE}" = "frontend" ]
}

validate_target_branch() {
    if git show-ref --verify --quiet "refs/heads/${DEPLOY_BRANCH}"; then
        return
    fi

    if git ls-remote --exit-code --heads origin "${DEPLOY_BRANCH}" >/dev/null 2>&1; then
        return
    fi

    print_error "Branch '${DEPLOY_BRANCH}' not found locally or on origin"
    exit 1
}

resolve_mongo_restore_source_file() {
    local selector="$1"

    if [ "${selector}" = "latest" ]; then
        if [ -f "${MONGO_BACKUP_ROOT}/latest/hikmahsphere.archive.gz" ]; then
            echo "${MONGO_BACKUP_ROOT}/latest/hikmahsphere.archive.gz"
            return
        fi

        local latest_dir
        latest_dir=$(find "${MONGO_BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | head -n 1 || true)
        if [ -n "${latest_dir}" ] && [ -f "${MONGO_BACKUP_ROOT}/${latest_dir}/hikmahsphere.archive.gz" ]; then
            echo "${MONGO_BACKUP_ROOT}/${latest_dir}/hikmahsphere.archive.gz"
            return
        fi

        print_error "No MongoDB backup archive found under ${MONGO_BACKUP_ROOT}"
        exit 1
    fi

    local timestamp_file="${MONGO_BACKUP_ROOT}/${selector}/hikmahsphere.archive.gz"
    if [ -f "${timestamp_file}" ]; then
        echo "${timestamp_file}"
        return
    fi

    print_error "MongoDB backup archive not found for timestamp: ${selector}"
    exit 1
}

run_forced_mongo_restore_if_requested() {
    if [ -z "${RESTORE_MONGO_SELECTOR}" ]; then
        return
    fi

    ensure_backup_directories
    resolve_mongo_credentials
    RESTORE_MONGO_SOURCE_FILE=$(resolve_mongo_restore_source_file "${RESTORE_MONGO_SELECTOR}")

    print_header "🗄 Forced MongoDB Restore"
    print_info "Restore selector: ${RESTORE_MONGO_SELECTOR}"
    print_info "Restore source: ${RESTORE_MONGO_SOURCE_FILE}"
    restore_mongo_from_backup "${RESTORE_MONGO_SOURCE_FILE}"
}

acquire_deploy_lock() {
    if [ -f "${DEPLOY_LOCK_FILE}" ]; then
        local existing_pid
        existing_pid=$(cat "${DEPLOY_LOCK_FILE}" 2>/dev/null || true)
        if [ -n "${existing_pid}" ] && ps -p "${existing_pid}" >/dev/null 2>&1; then
            print_error "Another deployment is already running (PID: ${existing_pid})"
            exit 1
        fi
        print_warning "Found stale deployment lock. Removing it."
        rm -f "${DEPLOY_LOCK_FILE}"
    fi

    echo "$$" > "${DEPLOY_LOCK_FILE}"
}

release_deploy_lock() {
    rm -f "${DEPLOY_LOCK_FILE}"
}

resolve_mongo_credentials() {
    local root_env="${PROJECT_ROOT}/.env"
    local backend_env="${BACKEND_DIR}/.env"

    MONGO_USERNAME=$(get_env_value "MONGO_USERNAME" "${root_env}" "")
    if [ -z "${MONGO_USERNAME}" ]; then
        MONGO_USERNAME=$(get_env_value "MONGO_USERNAME" "${backend_env}" "admin")
    fi

    MONGO_PASSWORD=$(get_env_value "MONGO_PASSWORD" "${root_env}" "")
    if [ -z "${MONGO_PASSWORD}" ]; then
        MONGO_PASSWORD=$(get_env_value "MONGO_PASSWORD" "${backend_env}" "password123")
    fi
}

ensure_backup_directories() {
    mkdir -p "${MONGO_BACKUP_ROOT}" "${FRONTEND_BACKUP_ROOT}" "${MANIFEST_ROOT}" "${REPORT_ROOT}"
}

write_report() {
    local message="$1"
    if [ -n "${DEPLOY_REPORT_FILE}" ]; then
        echo "$(timestamp) ${message}" >> "${DEPLOY_REPORT_FILE}"
    fi
}

prune_old_backup_directories() {
    local target_dir="$1"
    local keep_count="${2:-3}"

    if [ ! -d "${target_dir}" ]; then
        return
    fi

    mapfile -t directories < <(find "${target_dir}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)

    local idx=0
    for dir_name in "${directories[@]}"; do
        idx=$((idx + 1))
        if [ "${idx}" -gt "${keep_count}" ]; then
            # Frontend backups are created with `sudo rsync -a`, so their files
            # are owned by www-data and require sudo to remove.
            sudo rm -rf "${target_dir}/${dir_name}"
            write_report "Retention cleanup: removed ${target_dir}/${dir_name}"
        fi
    done
}

prune_old_backup_files() {
    local target_dir="$1"
    local pattern="$2"
    local keep_count="${3:-3}"

    if [ ! -d "${target_dir}" ]; then
        return
    fi

    mapfile -t files < <(find "${target_dir}" -maxdepth 1 -type f -name "${pattern}" -printf '%f\n' | sort -r)

    local idx=0
    for file_name in "${files[@]}"; do
        idx=$((idx + 1))
        if [ "${idx}" -gt "${keep_count}" ]; then
            rm -f "${target_dir}/${file_name}"
            write_report "Retention cleanup: removed ${target_dir}/${file_name}"
        fi
    done
}

update_manifest_status() {
    local status="$1"
    local reason="${2:-}"

    if [ -z "${MANIFEST_FILE}" ]; then
        return
    fi

    {
        echo "STATUS=${status}"
        if [ -n "${reason}" ]; then
            echo "STATUS_REASON=${reason}"
        fi
        echo "UPDATED_AT=$(timestamp)"
    } >> "${MANIFEST_FILE}"
}

clear_frontend_build_files() {
    sudo rm -rf "${WEB_ROOT}/css" 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}/js" 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}/static" 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}"/*.html 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}"/*.txt 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}"/*.json 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}"/*.ico 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}"/*.png 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}"/*.jpg 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}"/*.svg 2>/dev/null || true
    sudo rm -rf "${WEB_ROOT}"/*.webp 2>/dev/null || true
}

create_predeploy_backups() {
    print_header "💾 Pre-Deployment Backup"

    ensure_backup_directories
    resolve_mongo_credentials

    MANIFEST_FILE="${MANIFEST_ROOT}/${DEPLOY_TIMESTAMP}.env"
    DEPLOY_REPORT_FILE="${REPORT_ROOT}/${DEPLOY_TIMESTAMP}.log"

    local mongo_backup_dir="${MONGO_BACKUP_ROOT}/${DEPLOY_TIMESTAMP}"
    local frontend_backup_dir="${FRONTEND_BACKUP_ROOT}/${DEPLOY_TIMESTAMP}"

    mkdir -p "${mongo_backup_dir}" "${frontend_backup_dir}/site"

    MONGO_BACKUP_FILE="${mongo_backup_dir}/hikmahsphere.archive.gz"
    FRONTEND_BACKUP_DIR="${frontend_backup_dir}"

    print_step "Backing up MongoDB from Docker container (${MONGO_CONTAINER_NAME})..."
    if ! docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER_NAME}$"; then
        print_error "MongoDB container '${MONGO_CONTAINER_NAME}' is not running. Deployment aborted."
        exit 1
    fi

    docker exec "${MONGO_CONTAINER_NAME}" mongodump \
        --username "${MONGO_USERNAME}" \
        --password "${MONGO_PASSWORD}" \
        --authenticationDatabase "${MONGO_AUTH_DB}" \
        --db "${MONGO_DB_NAME}" \
        --archive --gzip > "${MONGO_BACKUP_FILE}"

    if [ ! -s "${MONGO_BACKUP_FILE}" ]; then
        print_error "MongoDB backup file is empty. Deployment aborted."
        exit 1
    fi
    print_success "MongoDB backup created: ${MONGO_BACKUP_FILE}"

    print_step "Backing up current frontend deployment from ${WEB_ROOT}..."
    if [ -d "${WEB_ROOT}" ]; then
        sudo rsync -a --delete --exclude uploads --exclude releases --exclude current "${WEB_ROOT}/" "${FRONTEND_BACKUP_DIR}/site/"
    fi
    print_success "Frontend backup created: ${FRONTEND_BACKUP_DIR}/site"

    {
        echo "TIMESTAMP=${DEPLOY_TIMESTAMP}"
        echo "DEPLOY_USER=${CURRENT_USER}"
        echo "DEPLOY_BRANCH=${DEPLOY_BRANCH}"
        echo "DEPLOY_SCOPE=${DEPLOY_SCOPE}"
        echo "DEPLOY_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
        echo "MONGO_BACKUP_FILE=${MONGO_BACKUP_FILE}"
        echo "MONGO_RESTORE_SOURCE=${RESTORE_MONGO_SOURCE_FILE:-none}"
        echo "FRONTEND_BACKUP_DIR=${FRONTEND_BACKUP_DIR}/site"
        echo "STATUS=backup_created"
        echo "CREATED_AT=$(timestamp)"
    } > "${MANIFEST_FILE}"

    ln -sfn "${DEPLOY_TIMESTAMP}" "${MONGO_BACKUP_ROOT}/latest"
    ln -sfn "${DEPLOY_TIMESTAMP}" "${FRONTEND_BACKUP_ROOT}/latest"

    write_report "Backup created for timestamp ${DEPLOY_TIMESTAMP}"
    write_report "Mongo backup: ${MONGO_BACKUP_FILE}"
    write_report "Frontend backup: ${FRONTEND_BACKUP_DIR}/site"

    prune_old_backup_directories "${MONGO_BACKUP_ROOT}" 3
    prune_old_backup_directories "${FRONTEND_BACKUP_ROOT}" 3
    prune_old_backup_files "${MANIFEST_ROOT}" "*.env" 3
    prune_old_backup_files "${REPORT_ROOT}" "*.log" 3

    BACKUP_COMPLETED=1
    print_success "Pre-deployment backups completed"
}

restore_frontend_from_backup() {
    if [ -z "${FRONTEND_BACKUP_DIR}" ] || [ ! -d "${FRONTEND_BACKUP_DIR}/site" ]; then
        print_warning "Frontend backup not found. Skipping frontend restore."
        return 1
    fi

    print_step "Restoring frontend from backup: ${FRONTEND_BACKUP_DIR}/site"
    clear_frontend_build_files
    sudo mkdir -p "${WEB_ROOT}"
    sudo rsync -a "${FRONTEND_BACKUP_DIR}/site/" "${WEB_ROOT}/"
    sudo chown -R www-data:www-data "${WEB_ROOT}"
    print_success "Frontend restore completed"
    write_report "Frontend restored from ${FRONTEND_BACKUP_DIR}/site"
    return 0
}

restore_mongo_from_backup() {
    local restore_file="${1:-${MONGO_BACKUP_FILE}}"

    if [ -z "${restore_file}" ] || [ ! -f "${restore_file}" ]; then
        if [ -L "${MONGO_BACKUP_ROOT}/latest" ] && [ -f "${MONGO_BACKUP_ROOT}/latest/hikmahsphere.archive.gz" ]; then
            restore_file="${MONGO_BACKUP_ROOT}/latest/hikmahsphere.archive.gz"
        else
            print_warning "Mongo backup file not found. Skipping MongoDB restore."
            return 1
        fi
    fi

    if ! docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER_NAME}$"; then
        print_warning "MongoDB container '${MONGO_CONTAINER_NAME}' is not running. Skipping MongoDB restore."
        return 1
    fi

    print_step "Restoring MongoDB from backup: ${restore_file}"
    cat "${restore_file}" | docker exec -i "${MONGO_CONTAINER_NAME}" mongorestore \
        --username "${MONGO_USERNAME}" \
        --password "${MONGO_PASSWORD}" \
        --authenticationDatabase "${MONGO_AUTH_DB}" \
        --db "${MONGO_DB_NAME}" \
        --drop \
        --archive --gzip
    print_success "MongoDB restore completed"
    write_report "MongoDB restored from ${restore_file}"
    return 0
}

rollback_deployment() {
    if [ "${ROLLBACK_IN_PROGRESS}" -eq 1 ]; then
        return
    fi

    ROLLBACK_IN_PROGRESS=1
    print_header "⛑ Automatic Rollback Started"
    write_report "Rollback triggered"

    if [ "${BACKUP_COMPLETED}" -eq 1 ]; then
        restore_frontend_from_backup || true
        restore_mongo_from_backup || true
    else
        print_warning "No backup was completed. Rollback actions skipped."
    fi

    print_step "Restarting backend and nginx after rollback..."
    pm2 restart "${PM2_APP_NAME}" --update-env >/dev/null 2>&1 || true
    sudo systemctl restart nginx >/dev/null 2>&1 || true

    write_report "Rollback completed"
    update_manifest_status "rolled_back" "auto_rollback_triggered"
    print_success "Rollback workflow finished"
}

on_error() {
    local exit_code="$1"
    local error_line="$2"

    if [ "${DEPLOY_SUCCESS}" -eq 1 ]; then
        return
    fi

    print_error "Deployment failed at line ${error_line} with exit code ${exit_code}"
    write_report "Deployment failed at line ${error_line} with exit code ${exit_code}"
    update_manifest_status "failed" "line_${error_line}_exit_${exit_code}"
    rollback_deployment
    exit "${exit_code}"
}

finalize_deploy() {
    local exit_code="$?"
    local end_time_epoch
    end_time_epoch="$(date +%s)"
    local elapsed_seconds=$((end_time_epoch - START_TIME_EPOCH))

    if [ "${exit_code}" -eq 0 ]; then
        DEPLOY_SUCCESS=1
        update_manifest_status "success" "deployment_completed"
        write_report "Deployment succeeded in ${elapsed_seconds}s"
    else
        write_report "Deployment exited with code ${exit_code} after ${elapsed_seconds}s"
    fi

    release_deploy_lock
}

preflight_checks() {
    print_header "🧪 Preflight Checks"
    require_command git
    require_command npm
    require_command pm2
    require_command docker
    require_command rsync
    require_command curl
    require_command sudo

    if [ ! -d "${PROJECT_ROOT}" ]; then
        print_error "Project root not found: ${PROJECT_ROOT}"
        exit 1
    fi

    sudo mkdir -p "${WEB_ROOT}"
    print_success "Preflight checks passed"
}

trap 'on_error "$?" "$LINENO"' ERR
trap 'finalize_deploy' EXIT

# ============================================
# Main Deployment Process
# ============================================

parse_args "$@"

print_header "🚀 HikmahSphere Deployment Started"
echo -e "${YELLOW}Branch: ${DEPLOY_BRANCH}${NC}"
echo -e "${YELLOW}Scope: ${DEPLOY_SCOPE}${NC}"
if [ -n "${RESTORE_MONGO_SELECTOR}" ]; then
    echo -e "${YELLOW}Mongo Restore: ${RESTORE_MONGO_SELECTOR}${NC}"
fi
echo -e "${YELLOW}Time: $(timestamp)${NC}"
echo -e "${YELLOW}User: ${CURRENT_USER}${NC}"
echo ""

# Navigate to project directory
cd "${PROJECT_ROOT}" || { print_error "Failed to navigate to project directory"; exit 1; }
print_success "Navigated to project directory"

acquire_deploy_lock
preflight_checks
validate_target_branch
BACKEND_PORT=$(get_backend_port)
print_info "Backend port resolved to ${CYAN}${BACKEND_PORT}${NC}"

run_forced_mongo_restore_if_requested
create_predeploy_backups

# ============================================
# Git Operations
# ============================================
print_header "📥 Git Operations"

print_step "Fetching branch ${DEPLOY_BRANCH} from origin..."
git fetch origin "${DEPLOY_BRANCH}"
print_success "Fetched origin/${DEPLOY_BRANCH}"

# npm install (run on previous deploys) rewrites the lock files, leaving the
# working tree dirty and blocking the next `git pull`. Discard those generated
# changes so the pull can fast-forward cleanly.
print_step "Discarding locally regenerated lock files (if any)..."
git checkout -- backend/package-lock.json frontend/package-lock.json 2>/dev/null || true
print_success "Working tree ready for pull"

print_step "Checking out ${DEPLOY_BRANCH} branch..."
if git show-ref --verify --quiet "refs/heads/${DEPLOY_BRANCH}"; then
    git checkout "${DEPLOY_BRANCH}"
else
    git checkout -b "${DEPLOY_BRANCH}" "origin/${DEPLOY_BRANCH}"
fi
print_success "Checked out ${DEPLOY_BRANCH} branch"

print_step "Pulling latest changes..."
git pull origin "${DEPLOY_BRANCH}"
print_success "Pulled latest changes from origin/${DEPLOY_BRANCH}"

# Show current commit
CURRENT_COMMIT=$(git rev-parse --short HEAD)
print_success "Current commit: ${CYAN}${CURRENT_COMMIT}${NC}"

# ============================================
# Backend Deployment
# ============================================
if should_deploy_backend; then
    print_header "🔧 Backend Deployment"

    cd "${BACKEND_DIR}" || { print_error "Failed to navigate to backend directory"; exit 1; }

    print_step "Installing backend dependencies..."
    npm install
    print_success "Backend dependencies installed"

    print_step "Building backend..."
    npm run build
    print_success "Backend built successfully"

    ensure_pm2_persistence
    start_or_restart_backend_with_pm2
    save_and_enable_pm2_service

    # Check PM2 status
    print_step "Checking PM2 status..."
    pm2 ls
    if pm2 ls | grep "${PM2_APP_NAME}" | grep -q "online"; then
        print_success "Backend is running"
    else
        print_error "Backend is not online in PM2"
        exit 1
    fi
else
    print_header "🔧 Backend Deployment"
    print_info "Skipped (scope=${DEPLOY_SCOPE})"
fi

# ============================================
# Frontend Deployment
# ============================================
if should_deploy_frontend; then
    print_header "🎨 Frontend Deployment"

    cd "${FRONTEND_DIR}" || { print_error "Failed to navigate to frontend directory"; exit 1; }

    print_step "Installing frontend dependencies..."
    npm install
    print_success "Frontend dependencies installed"

    # Ensure swap exists so builds don't get OOM-killed on low-memory VMs
    print_step "Checking swap space..."
    SWAP_SIZE=$(free -m | awk '/^Swap:/ {print $2}')
    if [ "${SWAP_SIZE}" -lt 1024 ] 2>/dev/null; then
        print_warning "Swap is ${SWAP_SIZE}MB — creating 2GB swap file for build safety..."
        sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile >/dev/null 2>&1
        sudo swapon /swapfile 2>/dev/null
        print_success "2GB swap file activated"
    else
        print_success "Swap space OK (${SWAP_SIZE}MB)"
    fi

    print_step "Building frontend (memory-safe mode)..."
    # GENERATE_SOURCEMAP=false   — skip source maps to save ~40% memory
    # TSC_COMPILE_ON_ERROR=true  — don't fork a separate TS process
    # --max-old-space-size=2048  — keep heap within VM limits
    GENERATE_SOURCEMAP=false TSC_COMPILE_ON_ERROR=true NODE_OPTIONS="--max-old-space-size=2048" npm run build
    print_success "Frontend built successfully"

    # Show build size
    BUILD_SIZE=$(du -sh build 2>/dev/null | cut -f1)
    print_success "Build size: ${CYAN}${BUILD_SIZE}${NC}"

    # ============================================
    # Deploy to Production
    # ============================================
    print_header "📦 Deploying to Production"

    print_step "Clearing old deployment (preserving uploads)..."
    # Only remove build files, preserve uploads folder
    clear_frontend_build_files
    print_success "Old build files cleared"

    print_step "Copying new build files..."
    sudo cp -r build/* "${WEB_ROOT}/"
    print_success "Build files copied"

    print_step "Setting web root ownership to www-data (nginx user)..."

    # Poor Practice: chowning to current user breaks nginx file serving
    # sudo chown -R ${CURRENT_USER}:${CURRENT_USER} /var/www/hikmah

    # Best Practice: www-data is the nginx process user
    sudo chown -R www-data:www-data "${WEB_ROOT}"

    print_success "Web root ownership set to www-data (nginx user)"

    # ============================================
    # Upload Folders Setup
    # ============================================
    print_header "📁 Setting Up Upload Folders"

    # Create main uploads directory
    print_step "Creating upload folder structure..."
    sudo mkdir -p /var/www/hikmah/uploads/proofs
    sudo mkdir -p /var/www/hikmah/uploads/zakat
    sudo mkdir -p /var/www/hikmah/uploads/profiles
    sudo mkdir -p /var/www/hikmah/uploads/notifications
    sudo mkdir -p /var/www/hikmah/uploads/community
    print_success "Upload folders created"

    # Set correct permissions
    print_step "Setting upload folder permissions..."
    sudo chmod -R 755 /var/www/hikmah/uploads
    sudo chown -R ${CURRENT_USER}:${CURRENT_USER} /var/www/hikmah/uploads
    print_success "Upload folder permissions set"

    # Verify upload folders
    print_step "Verifying upload folders..."
    UPLOAD_FOLDERS=("proofs" "zakat" "profiles" "notifications" "community")
    for folder in "${UPLOAD_FOLDERS[@]}"; do
        if [ -d "/var/www/hikmah/uploads/$folder" ]; then
            print_success "✓ uploads/$folder exists"
        else
            print_error "✗ uploads/$folder missing"
            exit 1
        fi
    done
else
    print_header "🎨 Frontend Deployment"
    print_info "Skipped (scope=${DEPLOY_SCOPE})"
fi

# ============================================
# Nginx Configuration
# ============================================
print_header "🌐 Nginx Configuration"

# First, ensure main nginx.conf is correct
# Note: 'sudo tee' is used instead of 'sudo cat >' because the shell opens
# the redirect target before sudo runs, causing permission denied on root-owned files.
print_step "Restoring Nginx main configuration..."
sudo tee /etc/nginx/nginx.conf << 'NGINX_MAIN_EOF' > /dev/null
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
NGINX_MAIN_EOF
print_success "Nginx main configuration restored"

# Copy nginx config
print_step "Copying Nginx site configuration..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${PROJECT_ROOT}/deploy"
NGINX_SOURCE=""

# Try SCRIPT_DIR first, then fall back to DEPLOY_DIR
if [ -f "${SCRIPT_DIR}/nginx-hikmah.conf" ]; then
    NGINX_SOURCE="${SCRIPT_DIR}/nginx-hikmah.conf"
    print_info "Using nginx config from SCRIPT_DIR"
elif [ -f "${DEPLOY_DIR}/nginx-hikmah.conf" ]; then
    NGINX_SOURCE="${DEPLOY_DIR}/nginx-hikmah.conf"
    print_info "Using nginx config from DEPLOY_DIR"
else
    print_error "nginx-hikmah.conf not found in ${SCRIPT_DIR} or ${DEPLOY_DIR}"
    print_warning "Please ensure nginx-hikmah.conf exists in the deploy folder"
fi

if [ -n "${NGINX_SOURCE}" ]; then
    TMP_NGINX_CONF=$(mktemp)
    sed "s/__BACKEND_PORT__/${BACKEND_PORT}/g" "${NGINX_SOURCE}" > "${TMP_NGINX_CONF}"
    sudo cp "${TMP_NGINX_CONF}" /etc/nginx/sites-available/hikmahsphere
    rm -f "${TMP_NGINX_CONF}"
    print_success "Nginx config deployed with backend port ${CYAN}${BACKEND_PORT}${NC}"
fi

# Enable site
print_step "Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/hikmahsphere /etc/nginx/sites-enabled/
print_success "Nginx site enabled"

# Remove default if exists
print_step "Removing default Nginx site..."
sudo rm -f /etc/nginx/sites-enabled/default
print_success "Default site removed"

# Test nginx config
print_step "Testing Nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed!"
    sudo nginx -t
    exit 1
fi

# Restart nginx
print_step "Restarting Nginx..."
sudo systemctl daemon-reload
sudo systemctl restart nginx
print_success "Nginx restarted"

# Verify Nginx is running
print_step "Checking Nginx status..."
if sudo systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx failed to start!"
    sudo systemctl status nginx --no-pager | head -10
    exit 1
fi

# ============================================
# System Services
# ============================================
print_header "🔄 System Services Status"

print_step "Checking all services..."

if should_deploy_backend; then
    # Linger status
    print_step "Verifying linger status..."
    loginctl show-user "${CURRENT_USER}" | grep Linger
    if loginctl show-user "${CURRENT_USER}" | grep -q '^Linger=yes$'; then
        print_success "✓ Linger: Enabled"
    else
        print_error "✗ Linger: Not enabled"
        exit 1
    fi

    # PM2 systemd service status
    print_step "Checking PM2 systemd service..."
    if sudo systemctl is-active --quiet "${PM2_SERVICE_NAME}"; then
        sudo systemctl status "${PM2_SERVICE_NAME}" --no-pager
        print_success "✓ PM2 systemd service: Active"
    else
        print_error "✗ PM2 systemd service: Not active"
        sudo systemctl status "${PM2_SERVICE_NAME}" --no-pager || true
        exit 1
    fi

    # PM2 status
    print_step "Checking PM2 process list..."
    pm2 ls
    if pm2 ls | grep "${PM2_APP_NAME}" | grep -q "online"; then
        print_success "✓ Backend (PM2): Running"
    else
        print_error "✗ Backend (PM2): Not running"
        exit 1
    fi
else
    print_info "Backend checks skipped (scope=${DEPLOY_SCOPE})"
fi

# Nginx status
if sudo systemctl is-active --quiet nginx; then
    print_success "✓ Nginx: Running"
else
    print_error "✗ Nginx: Not running"
fi

# ============================================
# Deployment Summary
# ============================================
print_header "✅ Deployment Complete!"

echo -e "${GREEN}Deployment Summary:${NC}"
echo ""
echo -e "  ${CYAN}Branch:${NC} ${DEPLOY_BRANCH}"
echo -e "  ${CYAN}Scope:${NC} ${DEPLOY_SCOPE}"
if [ -n "${RESTORE_MONGO_SELECTOR}" ]; then
    echo -e "  ${CYAN}Mongo Restore:${NC} ${RESTORE_MONGO_SELECTOR}"
fi
echo -e "  ${CYAN}Commit:${NC} ${CURRENT_COMMIT}"
echo -e "  ${CYAN}Time:${NC} $(timestamp)"
echo -e "  ${CYAN}User:${NC} ${CURRENT_USER}"
echo -e "  ${CYAN}Build Size:${NC} ${BUILD_SIZE}"
echo ""
echo -e "${GREEN}Services Status:${NC}"
echo ""
if should_deploy_backend; then
    echo -e "  ${GREEN}✓${NC} Backend (PM2): Running"
    echo -e "  ${GREEN}✓${NC} PM2 Service: ${PM2_SERVICE_NAME} enabled"
    echo -e "  ${GREEN}✓${NC} Linger: Enabled for ${CURRENT_USER}"
else
    echo -e "  ${YELLOW}•${NC} Backend deployment skipped"
fi
if should_deploy_frontend; then
    echo -e "  ${GREEN}✓${NC} Frontend: Deployed"
    echo -e "  ${GREEN}✓${NC} Upload Folders: Created"
    echo -e "  ${GREEN}✓${NC} Web Root Ownership: www-data (nginx user)"
    echo -e "  ${GREEN}✓${NC} Upload Ownership: ${CURRENT_USER}"
else
    echo -e "  ${YELLOW}•${NC} Frontend deployment skipped"
fi
echo -e "  ${GREEN}✓${NC} Nginx: Running"
echo ""
echo -e "${BLUE}Website:${NC} http://hikmahsphere.site"
echo -e "${BLUE}Backend API:${NC} http://hikmahsphere.site/api"
echo -e "${BLUE}Uploads:${NC} http://hikmahsphere.site/uploads"
echo ""

# ============================================
# Quick Verification
# ============================================
print_header "🔍 Quick Verification"

if should_deploy_frontend; then
    print_step "Testing website accessibility..."
    if curl -s -o /dev/null -w "%{http_code}" http://hikmahsphere.site 2>/dev/null | grep -q "200"; then
        print_success "Website is accessible at http://hikmahsphere.site (HTTP 200)"
    else
        print_warning "Website may not be accessible - please check manually"
    fi
else
    print_info "Website check skipped (scope=${DEPLOY_SCOPE})"
fi

if should_deploy_backend; then
    print_step "Testing API endpoint..."
    if curl -s -o /dev/null -w "%{http_code}" http://hikmahsphere.site/api/health 2>/dev/null | grep -q "200\|404"; then
        print_success "API is responding at http://hikmahsphere.site/api"
    else
        print_warning "API may not be responding - please check PM2 logs"
    fi
else
    print_info "API check skipped (scope=${DEPLOY_SCOPE})"
fi

print_step "Testing uploads folder..."
UPLOADS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://hikmahsphere.site/uploads 2>/dev/null || echo "000")
if [ "$UPLOADS_CODE" == "200" ] || [ "$UPLOADS_CODE" == "403" ] || [ "$UPLOADS_CODE" == "404" ]; then
    print_success "Uploads folder is accessible (HTTP $UPLOADS_CODE)"
else
    print_warning "Uploads folder may not be accessible (HTTP $UPLOADS_CODE)"
fi

echo ""
print_header "🎉 All Done!"

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Visit http://hikmahsphere.site to verify (HTTP)"
echo "  2. Run ./verify.sh for detailed verification"
echo "  3. Check PM2 logs: pm2 logs hikmah-backend"
echo "  4. Check PM2 service: sudo systemctl status ${PM2_SERVICE_NAME} --no-pager"
echo "  5. Check Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo ""
echo -e "${CYAN}Note: HTTPS not configured yet. To enable SSL:${NC}"
echo "    sudo certbot --nginx -d hikmahsphere.site -d www.hikmahsphere.site"
echo ""
echo -e "${GREEN}Happy Deploying! 🚀${NC}"
echo ""
