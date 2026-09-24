#!/usr/bin/env bash
# File: dependency-checker.sh
# Version: 2.1.0 (Superset update to v2.0.0 — Stepwise Gap Mitigation)
# Desc: Arch Linux — iterative missing-dependency checker, installer, and
#       dependency-health manager. Audits installed packages via pacman -Dk,
#       resolves official vs AUR vs virtual-provider classification, audits
#       file integrity via pacman -Qk plus a Python stale-directory
#       heuristic, optionally deep-hashes every tracked file via pacman -Qkk,
#       reports orphans and pending upgrades, and can automatically rebuild
#       version-broken reverse dependents within a bounded, non-repeating
#       heal budget.
#
# Paradigm: Bounded-Orchestrator Shell Utility — strict-mode Bash; every
#           external execution is timeout-bounded; the primary flow is an
#           orchestrator only; host mutation happens exclusively through
#           pacman/yay under an explicit user-authorization model.
#
# Changelog (v2.1.0 — superset of v2.0.0; no baseline capability removed):
#   - Interactive Ceiling Bypass: Interactive mode (-i) prompts operator to
#     override MAX_AUTO_HEAL_BATCH_SIZE rather than hard-failing to report-only.
#   - Added -I/--force-heal-all flag to permit automated bulk healing in non-interactive runs.
#   - Chunked Transaction Engine: Splits bulk official re-installations into safe
#     bounded batches (50 packages/transaction) to mitigate pacman transaction failures.
#   - Strict Set-Intersection Validation: Filters package lists against live sync
#     databases (pacman -Slq) to eliminate AUR/foreign-repo lookup collisions.
#   - Pending Upgrade Preflight Guard: Systematically detects ABI transition risk
#     (e.g., Python minor updates) and coordinates sync before bulk file restorations.
set -euo pipefail
set -E

# ── Global variables ───────────────────────────────────────────────────────────
declare -r APP_NAME="dependency-checker"
declare -r APP_VERSION="2.1.0"
declare -r SYSTEM_LOG_DIR="/var/log/${APP_NAME}"
declare DEFAULT_LOGFILE="${SYSTEM_LOG_DIR}/${APP_NAME}.log"
declare LOGFILE="${DEFAULT_LOGFILE}"
declare LOG_FILE_READY=false
# One generation of log rotation before the active log exceeds this size.
declare -ri LOG_ROTATE_MAX_BYTES=$((10 * 1024 * 1024))

declare -r PACMAN_LOCK="/var/lib/pacman/db.lck"
declare ALL_SYSTEM=false
declare INTERACTIVE_MODE=false
declare PROMPT_IGNORE=false
declare DEBUG_MODE=false
declare YAY_AVAILABLE=false
declare SUDO_AVAILABLE=false
declare FIX_KEYS=false
declare HEAL_INTEGRITY=false
declare FORCE_HEAL_ALL=false
declare REPORT_ORPHANS=false
declare DEEP_INTEGRITY=false
declare STRICT_EXIT=false

# Populated by detect_pending_upgrades(); informational only.
declare -i PENDING_UPGRADES_COUNT=0
declare PENDING_PYTHON_UPGRADE=false
# Populated by deep_integrity_audit() when -e is given; report-only.
declare -a DEEP_INTEGRITY_FINDINGS=()
# Populated by report_orphans() when -o is given; report-only.
declare -a ORPHAN_PKGS=()

# Safety ceiling for heal_broken_packages:
declare -ri MAX_AUTO_HEAL_BATCH_SIZE=15
declare -ri REINSTALL_CHUNK_SIZE=50

declare -a DEFAULT_IGNORE_PKGS=("wayland")
declare -a CUSTOM_IGNORE_PKGS=()
declare -a CUSTOM_IGNORE_GROUPS=()
declare -a PACMAN_CONF_IGNORE_PKGS=()
declare -a TARGET_PKGLIST=()
declare -A INSTALLED_PKGS=()
declare -A OFFICIAL_PKGS=()
declare -A AUR_PKGS=()
declare -A PACKAGE_GROUPS=()
declare -a BROKEN_INTEGRITY_PKGS=()
declare -a STALE_PYTHON_ONLY_PKGS=()

declare -A PACKAGE_PROVIDES=()
declare -A PROVIDES_INDEX=()
declare -A PACKAGE_DEPENDS=()

declare TMP_DIR=""
declare -a last_missing=()
declare -a SCRIPT_ARGS=()
declare CMD_OUTPUT=""
declare -a MISSING_DEPS_RESULT=()

# Automated-heal budget:
declare -ri MAX_AUTO_HEAL_ATTEMPTS=3
declare -i AUTO_HEAL_ATTEMPTS_USED=0

# ── Bounded external execution ────────────────────────────────────────────────
declare -ri EXTERNAL_TIMEOUT_SECONDS=900
declare -ri SHORT_EXTERNAL_TIMEOUT_SECONDS=30
declare -ri TIMEOUT_KILL_GRACE_SECONDS=10

bounded_exec() {
	local seconds="$1"
	shift
	timeout --foreground --kill-after="${TIMEOUT_KILL_GRACE_SECONDS}s" "${seconds}" "$@"
}

# ── Color / tag setup ──────────────────────────────────────────────────────────
declare TPUT_AVAILABLE=false
declare COLORS_ENABLED=false
if command -v tput >/dev/null 2>&1; then
	TPUT_AVAILABLE=true
else
	printf "Note: 'tput' not found — color output disabled, continuing in plain text.\n" >&2
fi
if [[ "${TPUT_AVAILABLE}" = true && -t 1 && -t 2 && -z "${NO_COLOR:-}" ]]; then
	COLORS_ENABLED=true
fi
_t() { bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" tput "$@" 2>/dev/null || true; }
if [[ "${COLORS_ENABLED}" = true ]]; then
	OK="$(_t setaf 2)[OK]$(_t sgr0)"
	ERROR="$(_t setaf 1)[ERROR]$(_t sgr0)"
	NOTE="$(_t setaf 3)[NOTE]$(_t sgr0)"
	INFO="$(_t setaf 4)[INFO]$(_t sgr0)"
	WARN="$(_t setaf 1)[WARN]$(_t sgr0)"
	CAT="$(_t setaf 6)[ACTION]$(_t sgr0)"
	MAGENTA="$(_t setaf 5)"
	WARNING="$(_t setaf 1)"
	YELLOW="$(_t setaf 3)"
	GREEN="$(_t setaf 2)"
	BLUE="$(_t setaf 4)"
	SKY_BLUE="$(_t setaf 6)"
	RESET="$(_t sgr0)"
else
	OK="[OK]"
	ERROR="[ERROR]"
	NOTE="[NOTE]"
	INFO="[INFO]"
	WARN="[WARN]"
	CAT="[ACTION]"
	MAGENTA=""
	WARNING=""
	YELLOW=""
	GREEN=""
	BLUE=""
	SKY_BLUE=""
	RESET=""
fi

# ── Logging ────────────────────────────────────────────────────────────────────
log_message() {
	local level="$1"
	local message="$2"
	local timestamp color_tag=""

	[[ "${DEBUG_MODE}" = false && "${level}" = "DEBUG" ]] && return 0

	case "$level" in
	INFO) color_tag="$INFO" ;;
	WARN) color_tag="$WARN" ;;
	ERROR | FATAL) color_tag="$ERROR" ;;
	DEBUG) color_tag="$NOTE" ;;
	OK) color_tag="$OK" ;;
	*) color_tag="[$level]" ;;
	esac

	timestamp="$(printf '%(%Y-%m-%d %H:%M:%S)T' -1)"

	if [[ "${LOG_FILE_READY}" = true && -n "${LOGFILE:-}" ]]; then
		if ! printf "%s [%s] %s\n" "${timestamp}" "${level}" "${message}" >>"${LOGFILE}"; then
			printf "%s %s %s (WARNING: Could not write to log file)\n" \
				"${timestamp}" "${color_tag}" "${message}" >&2
		fi
	fi
	printf "%s %s %s\n" "${timestamp}" "${color_tag}" "${message}" >&2
}

error_handler() {
	local exit_status=$?
	local last_command="${BASH_COMMAND}"
	local line_number="${BASH_LINENO[0]:-unknown}"
	[[ "${exit_status}" -eq 0 ]] && return 0
	log_message "FATAL" "Script error on line ${line_number}: '${last_command}' exited with status ${exit_status}."
	printf "FATAL: Unexpected error. Check log: %s\n" "${LOGFILE}" >&2
	exit "${exit_status}"
}
trap error_handler ERR

cleanup() {
	local cleanup_status=0
	if [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR:-}" ]]; then
		log_message "INFO" "Cleaning up temporary directory: ${TMP_DIR}"
		bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" rm -rf -- "${TMP_DIR}" || {
			cleanup_status=1
			log_message "ERROR" "Failed to remove temporary directory: ${TMP_DIR}"
		}
	fi
	return "${cleanup_status}"
}
trap cleanup EXIT

trap 'printf "\nExiting...\n" >&2; exit 130' SIGINT

# ── String & tokenization utilities ───────────────────────────────────────────
trim_whitespace() {
	local value="$1"
	value="${value#"${value%%[![:space:]]*}"}"
	value="${value%"${value##*[![:space:]]}"}"
	printf '%s' "$value"
}

dependency_package_name() {
	local dep="$1"
	dep="${dep%%|*}"
	dep="$(trim_whitespace "$dep")"
	printf '%s' "${dep%%[<>=]*}"
}

is_ignored() {
	local pkg="$1" ignore_item pkg_groups

	for ignore_item in "${DEFAULT_IGNORE_PKGS[@]:-}" "${CUSTOM_IGNORE_PKGS[@]:-}" "${PACMAN_CONF_IGNORE_PKGS[@]:-}"; do
		if [[ -n "$ignore_item" && "$pkg" == "$ignore_item" ]]; then
			log_message "DEBUG" "Package '$pkg' ignored (listed as '$ignore_item')."
			return 0
		fi
	done

	pkg_groups="${PACKAGE_GROUPS[$pkg]:-}"
	if [[ -n "$pkg_groups" && ${#CUSTOM_IGNORE_GROUPS[@]} -gt 0 ]]; then
		for ignore_item in "${CUSTOM_IGNORE_GROUPS[@]:-}"; do
			if [[ " ${pkg_groups} " == *" ${ignore_item} "* ]]; then
				log_message "DEBUG" "Package '$pkg' ignored (group '$ignore_item')."
				return 0
			fi
		done
	fi

	log_message "DEBUG" "Package '$pkg' not ignored."
	return 1
}

# ── Spinner ────────────────────────────────────────────────────────────────────
show_spinner() {
	local pid="$1" delay=0.1 spinstr=$'|/-\\'
	local temp
	[[ -t 2 ]] || return 0
	while kill -0 "$pid" 2>/dev/null; do
		temp="${spinstr#?}"
		printf " [%c]  " "$spinstr" >&2
		spinstr="${temp}${spinstr%"$temp"}"
		sleep "$delay" || true
		printf "\b\b\b\b\b\b" >&2
	done
	printf "    \b\b\b\b" >&2
}

# ── run_command / run_logged_command ──────────────────────────────────────────
run_command() {
	local output_file exit_code=0 cmd_pid
	output_file="$(bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" mktemp -p "${TMP_DIR:-/tmp}" "cmd_output.XXXXXX")"

	bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" "$@" >"${output_file}" 2>&1 </dev/null &
	cmd_pid=$!
	show_spinner "$cmd_pid"
	if wait "$cmd_pid"; then
		exit_code=0
	else
		exit_code=$?
	fi

	CMD_OUTPUT="$(bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" tr -d '\0' <"${output_file}" 2>/dev/null || true)"
	bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" rm -f "${output_file}" 2>/dev/null || true

	if [[ ${exit_code} -ne 0 ]]; then
		log_message "DEBUG" "Command exited nonzero (rc=${exit_code}): $*"
		log_message "DEBUG" "Output: ${CMD_OUTPUT}"
	fi
	return "${exit_code}"
}

run_logged_command() {
	bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" "$@" </dev/null 2>&1 | bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" tee -a "${LOGFILE}"
	local -a pipe_status=("${PIPESTATUS[@]}")
	local command_status="${pipe_status[0]:-1}"
	local tee_status="${pipe_status[1]:-1}"
	if ((command_status != 0)); then
		return "${command_status}"
	fi
	if ((tee_status != 0)); then
		log_message "ERROR" "Unable to write command output to log file '${LOGFILE}'."
		return "${tee_status}"
	fi
	return 0
}

run_pacman_install() {
	wait_for_pacman_lock
	if run_logged_command "$@"; then
		return 0
	fi
	if [[ -e "${PACMAN_LOCK}" ]]; then
		log_message "WARN" "pacman operation failed while the database lock is held by another process — waiting for the lock and retrying once: $*"
		wait_for_pacman_lock
		if run_logged_command "$@"; then
			log_message "OK" "pacman operation succeeded on lock-contention retry: $*"
			return 0
		fi
	fi
	return 1
}

# ── run_yay ────────────────────────────────────────────────────────────────────
unprivileged_user() {
	local target_user="${SUDO_USER:-}"
	if [[ -z "${target_user:-}" || "${target_user:-}" == "root" ]]; then
		target_user="$(logname 2>/dev/null || true)"
		if [[ -z "${target_user:-}" || "${target_user:-}" == "root" ]]; then
			target_user="$(id -nu 1000 2>/dev/null || true)"
		fi
	fi
	if [[ -n "${target_user:-}" && "${target_user:-}" != "root" ]]; then
		printf '%s' "$target_user"
		return 0
	fi
	return 1
}

run_yay() {
	if [[ "$SUDO_AVAILABLE" = false ]]; then
		log_message "ERROR" "Cannot execute yay/makepkg: 'sudo' is not available (checked in check_requirements)."
		return 1
	fi

	local target_user
	if ! target_user="$(unprivileged_user)"; then
		log_message "ERROR" "Cannot execute yay/makepkg as root without an identifiable unprivileged host user (\$SUDO_USER)."
		return 1
	fi

	log_message "INFO" "Executing yay build pipeline as unprivileged user '${target_user}'..."
	run_logged_command sudo -u "$target_user" yay \
		--cleanmenu=false --diffmenu=false --editmenu=false \
		--answerclean=None --answerdiff=None --answeredit=None --answerupgrade=None \
		"$@"
}

# ── Prerequisites & target preflights ─────────────────────────────────────────
require_root() {
	if [[ "${EUID}" -ne 0 ]]; then
		printf "Re-running with sudo privileges...\n" >&2
		if ! command -v sudo >/dev/null 2>&1; then
			printf "Error: sudo is required when not running as root.\n" >&2
			exit 1
		fi
		local self="$0" resolved_self
		if [[ "$self" != /* && "$self" != */* ]]; then
			resolved_self="$(command -v -- "$self" 2>/dev/null || true)"
			if [[ -n "$resolved_self" ]]; then
				self="$resolved_self"
			fi
		fi
		if ! bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" sudo -- "$self" "${SCRIPT_ARGS[@]}"; then
			printf "Failed to escalate privileges. Exiting.\n" >&2
			exit 1
		fi
		exit 0
	fi
	log_message "INFO" "Root privileges confirmed."
}

prepare_log_dir() {
	local log_directory log_size
	log_directory="${LOGFILE%/*}"
	if [[ "${log_directory}" == "${LOGFILE}" ]]; then
		log_directory="."
	elif [[ -z "${log_directory}" ]]; then
		log_directory="/"
	fi
	if [[ ! -d "${log_directory}" ]]; then
		log_message "INFO" "Creating log directory: ${log_directory}"
		if ! bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" mkdir -p -- "${log_directory}"; then
			printf "Error: Cannot create log directory: %s\n" "${log_directory}" >&2
			exit 1
		fi
	fi
	if [[ -f "${LOGFILE}" ]]; then
		log_size="$(bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" find -- "${LOGFILE}" -maxdepth 0 -printf '%s' 2>/dev/null || true)"
		if [[ "${log_size}" =~ ^[0-9]+$ ]] && ((log_size > LOG_ROTATE_MAX_BYTES)); then
			if bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" cp -- "${LOGFILE}" "${LOGFILE}.old"; then
				: >"${LOGFILE}"
				log_message "INFO" "Log rotated (${log_size} bytes > ${LOG_ROTATE_MAX_BYTES}); previous generation: ${LOGFILE}.old"
			else
				log_message "WARN" "Log exceeded ${LOG_ROTATE_MAX_BYTES} bytes but rotation failed — continuing to append."
			fi
		fi
	fi
	if ! bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" touch -- "${LOGFILE}" >/dev/null 2>&1; then
		printf "Error: Cannot write to log file: %s\n" "${LOGFILE}" >&2
		exit 1
	fi
	LOG_FILE_READY=true
	log_message "INFO" "Log file prepared: ${LOGFILE}"
}

check_requirements() {
	log_message "INFO" "Checking system requirements..."
	local tool
	local -a essential_tools=(
		"pacman" "awk" "grep" "sort" "df" "mktemp"
		"sed" "tee" "sha256sum" "pgrep" "timeout"
		"pacman-key" "tr" "cut" "mkdir" "rm" "cp"
		"touch" "sleep" "pacman-conf" "find" "comm"
	)
	local -a missing_tools=()

	if command -v yay >/dev/null 2>&1; then
		YAY_AVAILABLE=true
		log_message "INFO" "'yay' found — AUR support enabled."
	else
		YAY_AVAILABLE=false
		log_message "INFO" "'yay' not found — AUR support limited to identification."
	fi

	if command -v sudo >/dev/null 2>&1; then
		SUDO_AVAILABLE=true
		log_message "INFO" "'sudo' found — AUR builds can drop to an unprivileged user."
	else
		SUDO_AVAILABLE=false
		log_message "WARN" "'sudo' not found — AUR builds will be unavailable even if 'yay' is present (makepkg refuses to run as root)."
	fi

	for tool in "${essential_tools[@]}"; do
		command -v "${tool}" >/dev/null 2>&1 || missing_tools+=("${tool}")
	done

	if [[ ${#missing_tools[@]} -gt 0 ]]; then
		log_message "ERROR" "Essential tools missing: ${missing_tools[*]}"
		printf "Error: Essential tools missing: %s\n" "${missing_tools[*]}" >&2
		exit 1
	fi
	log_message "INFO" "All essential tools found."
}

wait_for_pacman_lock() {
	log_message "INFO" "Checking for pacman lock..."
	local wait_time=120 interval=5 elapsed=0

	while [[ -e "${PACMAN_LOCK}" ]]; do
		if command -v fuser >/dev/null 2>&1 && bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" fuser "${PACMAN_LOCK}" >/dev/null 2>&1; then
			log_message "INFO" "Pacman database lock is currently in use."
		elif bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" pgrep -x pacman >/dev/null 2>&1; then
			log_message "INFO" "pacman is running; waiting for database lock."
		else
			log_message "WARN" "Pacman lock exists but no active pacman process was detected; leaving lock untouched."
		fi

		if ((elapsed >= wait_time)); then
			log_message "ERROR" "pacman lock persists after ${wait_time}s."
			printf "Error: pacman lock persists. Verify no package manager is running, then remove only if confirmed stale: sudo rm -f %s\n" "${PACMAN_LOCK}" >&2
			exit 1
		fi
		log_message "INFO" "Waiting for pacman lock... (${elapsed}/${wait_time}s)"
		bounded_exec "$((interval + 2))" sleep "${interval}"
		((elapsed += interval))
	done
	log_message "INFO" "Pacman lock clear."
}

# ── System database actions ───────────────────────────────────────────────────
fix_pacman_keyring() {
	log_message "WARN" "Keyring repair requested. This is destructive and modifies pacman databases/keyring state."
	local success=0 backup_dir backup_stamp

	printf -v backup_stamp '%(%Y%m%d-%H%M%S)T' -1
	backup_dir="/var/tmp/${APP_NAME}-keyring-backup-${backup_stamp}"

	bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" mkdir -p -- "${backup_dir}"
	bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" find /var/tmp -maxdepth 1 -name "${APP_NAME}-keyring-backup-*" -mtime +30 -exec rm -rf -- {} + >/dev/null 2>&1 || true
	if [[ -d /etc/pacman.d/gnupg ]]; then
		bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" cp -a -- /etc/pacman.d/gnupg "${backup_dir}/gnupg" || {
			log_message "ERROR" "Unable to back up /etc/pacman.d/gnupg; refusing destructive repair."
			return 1
		}
	fi
	if [[ -d /var/lib/pacman/sync ]]; then
		bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" cp -a -- /var/lib/pacman/sync "${backup_dir}/sync" || {
			log_message "ERROR" "Unable to back up /var/lib/pacman/sync; refusing destructive repair."
			return 1
		}
	fi
	log_message "INFO" "Keyring/database backup stored at ${backup_dir} (persists after this run; auto-pruned after 30 days)."

	wait_for_pacman_lock
	if ! run_logged_command pacman -Syu --needed archlinux-keyring --noconfirm; then
		log_message "ERROR" "Failed to update archlinux-keyring with a synchronized system upgrade."
		success=1
	fi

	if ((success == 0)); then
		bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" rm -rf -- /var/lib/pacman/sync/* || {
			log_message "ERROR" "Failed to remove sync databases."
			success=1
		}
		bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" rm -rf -- /etc/pacman.d/gnupg/* || {
			log_message "ERROR" "Failed to remove gnupg contents."
			success=1
		}
	fi

	if ((success == 0)) && ! run_logged_command pacman-key --init; then
		log_message "ERROR" "pacman-key --init failed."
		success=1
	fi
	if ((success == 0)) && ! run_logged_command pacman-key --populate archlinux; then
		log_message "ERROR" "pacman-key --populate failed."
		success=1
	fi
	if ((success == 0)); then
		wait_for_pacman_lock
		if ! run_logged_command pacman -Syy --noconfirm; then
			log_message "ERROR" "Database refresh failed after keyring repair."
			success=1
		fi
	fi

	return "${success}"
}

refresh_pacman_databases() {
	local db_refresh_successful=false
	log_message "INFO" "Refreshing pacman database (pacman -Syy)..."
	wait_for_pacman_lock

	if run_logged_command pacman -Syy --noconfirm; then
		db_refresh_successful=true
		log_message "INFO" "Pacman database refreshed."
	else
		log_message "ERROR" "Failed to refresh pacman database."
		if [[ "$FIX_KEYS" = true ]]; then
			printf '\n%sEmergency keyring repair protocol (-f) activated.%s\n' "$WARNING" "$RESET" >&2
			printf "A backup will be created before keyring/database repair.\n" >&2
			printf "Are you absolutely sure? (y/N): " >&2
			local confirm
			read -r confirm
			if [[ "$confirm" =~ ^[Yy]$ ]]; then
				if fix_pacman_keyring; then
					db_refresh_successful=true
					log_message "INFO" "Database refreshed after keyring repair."
				else
					log_message "ERROR" "Keyring repair failed."
				fi
			else
				log_message "INFO" "Keyring repair aborted by user."
			fi
		else
			printf "Tip: run with '-f' to enable the keyring repair protocol.\n" >&2
		fi
	fi

	if [[ "${db_refresh_successful}" = true ]]; then
		log_message "INFO" "Verifying database integrity (pacman -Si filesystem)..."
		if ! run_command pacman -Si filesystem; then
			log_message "FATAL" "Failed to query 'filesystem' package — database is empty or corrupted."
			exit 1
		fi
		log_message "INFO" "Database integrity verified."
	else
		log_message "FATAL" "Unable to achieve a successful pacman database refresh. Exiting."
		exit 1
	fi
}

check_disk_space() {
	local required_kb=1048576 available_kb
	if ! available_kb="$(bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" df --output=avail -- / | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" awk 'NR==2 {gsub(/[[:space:]]/, "", $1); print $1}')"; then
		log_message "ERROR" "Unable to determine available disk space."
		return 1
	fi
	if [[ ! "$available_kb" =~ ^[0-9]+$ ]]; then
		log_message "ERROR" "Unable to parse available disk space: '$available_kb'."
		return 1
	fi
	if [[ "$available_kb" -lt "$required_kb" ]]; then
		log_message "ERROR" "Insufficient disk space. Available: $((available_kb / 1024))MB, Required: $((required_kb / 1024))MB."
		return 1
	fi
	log_message "INFO" "Disk space OK. Available: $((available_kb / 1024))MB."
	return 0
}

# ── Caching machinery ──────────────────────────────────────────────────────────
cache_package_lists() {
	log_message "INFO" "Caching package lists..."
	INSTALLED_PKGS=()
	OFFICIAL_PKGS=()
	AUR_PKGS=()

	log_message "INFO" "Caching installed packages (pacman -Qq)..."
	if ! run_command pacman -Qq; then
		log_message "FATAL" "pacman -Qq failed."
		exit 1
	fi
	while IFS= read -r pkg; do
		[[ -n "$pkg" ]] && INSTALLED_PKGS["$pkg"]=1
	done <<<"$CMD_OUTPUT"

	if [[ ${#INSTALLED_PKGS[@]} -eq 0 ]]; then
		log_message "FATAL" "No installed packages found."
		exit 1
	fi
	log_message "INFO" "Cached ${#INSTALLED_PKGS[@]} installed packages."

	log_message "INFO" "Caching official packages (pacman -Slq)..."
	if ! run_command pacman -Slq; then
		log_message "FATAL" "pacman -Slq failed."
		exit 1
	fi
	while IFS= read -r pkg; do
		[[ -n "$pkg" ]] && OFFICIAL_PKGS["$pkg"]=1
	done <<<"$CMD_OUTPUT"

	if [[ ${#OFFICIAL_PKGS[@]} -eq 0 ]]; then
		log_message "FATAL" "No official packages found — database may be corrupted."
		exit 1
	fi
	log_message "INFO" "Cached ${#OFFICIAL_PKGS[@]} official packages."

	if [[ "$YAY_AVAILABLE" = true ]]; then
		log_message "INFO" "Caching AUR packages (yay -Slqa)..."
		local -a yay_query_cmd=("yay" "-Slqa")
		local target_user
		if target_user="$(unprivileged_user 2>/dev/null || true)"; then
			yay_query_cmd=("sudo" "-u" "$target_user" "yay" "-Slqa")
		fi
		if run_command "${yay_query_cmd[@]}"; then
			while IFS= read -r pkg; do
				[[ -n "$pkg" ]] && AUR_PKGS["$pkg"]=1
			done <<<"$CMD_OUTPUT"
			log_message "INFO" "Cached ${#AUR_PKGS[@]} AUR packages."
		else
			log_message "WARN" "yay -Slqa failed — AUR resolution may be incomplete."
			CMD_OUTPUT=""
		fi
	fi
}

cache_package_groups() {
	log_message "INFO" "Caching package group, provides, and depends information..."
	PACKAGE_GROUPS=()
	PACKAGE_PROVIDES=()
	PROVIDES_INDEX=()
	PACKAGE_DEPENDS=()

	if ! LC_ALL=C run_command pacman -Qi; then
		log_message "WARN" "pacman -Qi failed — group-based ignore, provides resolution, and depends metadata disabled."
		return 0
	fi
	if [[ -z "$CMD_OUTPUT" ]]; then
		log_message "WARN" "pacman -Qi produced no output — group-based ignore, provides resolution, and depends metadata disabled."
		return 0
	fi

	local pkg groups provides depends provide_name
	while IFS=$'\t' read -r pkg groups provides depends; do
		[[ -z "$pkg" ]] && continue
		PACKAGE_GROUPS["$pkg"]="$groups"
		if [[ -n "$depends" && "$depends" != "None" ]]; then
			PACKAGE_DEPENDS["$pkg"]="$depends"
		fi
		if [[ -n "$provides" && "$provides" != "None" ]]; then
			PACKAGE_PROVIDES["$pkg"]="$provides"
			while IFS= read -r provide_name; do
				[[ -z "$provide_name" ]] && continue
				provide_name="$(dependency_package_name "$provide_name")"
				[[ -z "$provide_name" ]] && continue
				if [[ -n "${PROVIDES_INDEX[$provide_name]:-}" ]]; then
					if [[ "${PROVIDES_INDEX[$provide_name]}" != "$pkg" ]]; then
						log_message "DEBUG" "Provides collision for '$provide_name': already mapped to '${PROVIDES_INDEX[$provide_name]}', also provided by '$pkg' — keeping first."
					fi
				else
					PROVIDES_INDEX["$provide_name"]="$pkg"
				fi
			done < <(printf '%s' "$provides" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" tr ' ' '\n')
		fi
	done < <(
		printf '%s\n' "$CMD_OUTPUT" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" awk '
            function flush() {
                if (current_pkg != "") {
                    print current_pkg "\t" current_groups "\t" current_provides "\t" current_depends
                }
            }
            /^Name[[:space:]]*:/ {
                flush()
                current_pkg = $0
                sub(/^Name[[:space:]]*:[[:space:]]*/, "", current_pkg)
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_pkg)
                current_groups = ""
                current_provides = ""
                current_depends = ""
            }
            /^Groups[[:space:]]*:/ {
                current_groups = $0
                sub(/^Groups[[:space:]]*:[[:space:]]*/, "", current_groups)
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_groups)
            }
            /^Provides[[:space:]]*:/ {
                current_provides = $0
                sub(/^Provides[[:space:]]*:[[:space:]]*/, "", current_provides)
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_provides)
            }
            /^Depends On[[:space:]]*:/ {
                current_depends = $0
                sub(/^Depends On[[:space:]]*:[[:space:]]*/, "", current_depends)
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_depends)
            }
            END { flush() }
        '
	)

	if [[ ${#PACKAGE_GROUPS[@]} -eq 0 ]]; then
		log_message "WARN" "No package group info cached (normal if no installed packages have groups)."
	else
		log_message "INFO" "Cached group info for ${#PACKAGE_GROUPS[@]} packages."
	fi
	log_message "INFO" "Cached provides index for ${#PROVIDES_INDEX[@]} provided names across ${#PACKAGE_PROVIDES[@]} packages."
	log_message "INFO" "Cached depends metadata for ${#PACKAGE_DEPENDS[@]} packages."
}

resolve_installed_provider() {
	local name="$1"
	if [[ -n "${INSTALLED_PKGS[$name]:-}" ]]; then
		printf '%s' "$name"
		return 0
	fi
	if [[ -n "${PROVIDES_INDEX[$name]:-}" && -n "${INSTALLED_PKGS[${PROVIDES_INDEX[$name]}]:-}" ]]; then
		printf '%s' "${PROVIDES_INDEX[$name]}"
		return 0
	fi
	return 1
}

resolve_repo_package() {
	local name="$1" line candidate
	if [[ -n "${OFFICIAL_PKGS[$name]:-}" ]]; then
		printf '%s\n' "$name"
		return 0
	fi
	if ! LC_ALL=C run_command pacman -S --print --print-format '%n' --noconfirm -- "$name"; then
		return 1
	fi
	local -a resolved=()
	while IFS= read -r line; do
		[[ -z "$line" ]] && continue
		[[ "$line" =~ ^[a-z0-9@._+-]+$ ]] || continue
		[[ -n "${OFFICIAL_PKGS[$line]:-}" ]] || continue
		resolved+=("$line")
	done <<<"$CMD_OUTPUT"
	if [[ ${#resolved[@]} -eq 0 ]]; then
		return 1
	fi
	local -A emit_seen=()
	for candidate in "${resolved[@]}"; do
		[[ -n "${emit_seen[$candidate]:-}" ]] && continue
		emit_seen["$candidate"]=1
		printf '%s\n' "$candidate"
	done
	return 0
}

# ── Preflight System Upgrade Coordinator ──────────────────────────────────────
sync_system_preflight() {
	if ((PENDING_UPGRADES_COUNT == 0)); then
		return 0
	fi

	local confirm=""
	printf '\n%sSystem synchronization required: %d upgrade(s) pending%s%s\n' \
		"$WARNING" "$PENDING_UPGRADES_COUNT" \
		"${PENDING_PYTHON_UPGRADE:+ (including 'python')}" "$RESET" >&2
	printf 'Reinstalling packages during an ABI or runtime transition without full sync causes broken bindings.\n' >&2

	if [[ "$INTERACTIVE_MODE" = true ]]; then
		printf '%sPerform full system upgrade (pacman -Syu) now? (Y/n): %s' "$YELLOW" "$RESET" >&2
		read -r confirm
		if [[ "$confirm" =~ ^[Nn]$ ]]; then
			log_message "WARN" "User declined system upgrade preflight. Proceeding without sync."
			return 0
		fi
	elif [[ "$FORCE_HEAL_ALL" = false ]]; then
		log_message "WARN" "Unattended run detected pending upgrades. Refusing out-of-sync bulk reinstall."
		return 1
	fi

	log_message "INFO" "Executing preflight system upgrade (pacman -Syu --noconfirm)..."
	if run_pacman_install pacman -Syu --noconfirm; then
		log_message "OK" "Preflight system upgrade completed successfully."
		refresh_pacman_databases
		cache_package_lists
		cache_package_groups
		detect_pending_upgrades
		return 0
	else
		log_message "ERROR" "Preflight system upgrade failed."
		return 1
	fi
}

# ── System file-integrity audit ───────────────────────────────────────────────
audit_system_integrity() {
	log_message "INFO" "Auditing package file integrity (pacman -Qk)..."
	local -a verified_broken=() stale_python_candidates=()
	local pkg line exit_code=0

	if LC_ALL=C run_command pacman -Qk; then
		exit_code=0
	else
		exit_code=$?
	fi

	while IFS= read -r line; do
		[[ -z "$line" ]] && continue
		if [[ "$line" == *" missing files"* && "$line" != *" 0 missing files"* ]]; then
			pkg="${line%%:*}"
			if [[ "$pkg" =~ ^[a-z0-9@._+-]+$ ]]; then
				verified_broken+=("$pkg")
			else
				log_message "DEBUG" "pacman -Qk line produced an invalid package-name token, discarding: '$pkg' (from line: $line)"
			fi
		fi
	done <<<"$CMD_OUTPUT"

	local current_py
	if command -v python3 >/dev/null 2>&1; then
		current_py="$(bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" python3 -c 'import sys; print(f"python{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
		if [[ -n "$current_py" ]]; then
			log_message "INFO" "Current system Python: ${current_py}"
			local -a stale_dirs=()
			local py_dir
			for py_dir in /usr/lib/python3.*; do
				if [[ -d "$py_dir" && "${py_dir##*/}" != "$current_py" ]]; then
					stale_dirs+=("$py_dir")
				fi
			done

			if [[ ${#stale_dirs[@]} -gt 0 ]]; then
				log_message "WARN" "Found stale Python directories: ${stale_dirs[*]}"
				local sdir owner_line owner_pkg qo_exit=0
				local -i qo_offset=0
				local -ri QO_BATCH_SIZE=500
				for sdir in "${stale_dirs[@]}"; do
					local -a stale_files=()
					while IFS= read -r -d '' pkg; do
						stale_files+=("$pkg")
					done < <(bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" find "$sdir" -type f -print0 2>/dev/null || true)

					qo_offset=0
					while ((qo_offset < ${#stale_files[@]})); do
						local -a qo_batch=("${stale_files[@]:qo_offset:QO_BATCH_SIZE}")
						qo_offset=$((qo_offset + QO_BATCH_SIZE))
						if LC_ALL=C run_command pacman -Qo -- "${qo_batch[@]}"; then
							qo_exit=0
						else
							qo_exit=$?
						fi
						if ((qo_exit <= 1)); then
							while IFS= read -r owner_line; do
								[[ "$owner_line" == *" is owned by "* ]] || continue
								owner_pkg="${owner_line##* is owned by }"
								owner_pkg="${owner_pkg%% *}"
								[[ -n "$owner_pkg" ]] && stale_python_candidates+=("$owner_pkg")
							done <<<"$CMD_OUTPUT"
						else
							log_message "WARN" "pacman -Qo exited ${qo_exit} on a ${#qo_batch[@]}-file batch under '${sdir}' — ownership results discarded."
						fi
					done
				done
			fi
		fi
	fi

	if [[ ${#verified_broken[@]} -gt 0 ]]; then
		mapfile -t BROKEN_INTEGRITY_PKGS < <(printf "%s\n" "${verified_broken[@]}" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sort -u)
		log_message "WARN" "Integrity audit: ${#BROKEN_INTEGRITY_PKGS[@]} package(s) with pacman-verified missing files: ${BROKEN_INTEGRITY_PKGS[*]}"
	else
		log_message "INFO" "No pacman-verified missing files found."
		BROKEN_INTEGRITY_PKGS=()
	fi

	if [[ ${#stale_python_candidates[@]} -gt 0 ]]; then
		local -A verified_set=()
		for pkg in "${BROKEN_INTEGRITY_PKGS[@]}"; do verified_set["$pkg"]=1; done
		local -a filtered=()
		for pkg in "${stale_python_candidates[@]}"; do
			[[ -z "${verified_set[$pkg]:-}" ]] && filtered+=("$pkg")
		done
		if [[ ${#filtered[@]} -gt 0 ]]; then
			mapfile -t STALE_PYTHON_ONLY_PKGS < <(printf "%s\n" "${filtered[@]}" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sort -u)
			log_message "INFO" "Integrity audit: ${#STALE_PYTHON_ONLY_PKGS[@]} package(s) merely own a file under a stale Python directory."
		else
			STALE_PYTHON_ONLY_PKGS=()
		fi
	else
		STALE_PYTHON_ONLY_PKGS=()
	fi

	if [[ ${#BROKEN_INTEGRITY_PKGS[@]} -eq 0 && ${#STALE_PYTHON_ONLY_PKGS[@]} -eq 0 ]]; then
		log_message "INFO" "Integrity audit passed cleanly."
	fi
}

_heal_package_batch() {
	local label="$1"
	shift
	local -a candidates=("$@")
	[[ ${#candidates[@]} -eq 0 ]] && return 0

	log_message "INFO" "Initiating heal classification for ${#candidates[@]} ${label} package(s)..."
	local -a official_pkgs=() aur_pkgs=() protected_pkgs=()
	local -A base_group_pkgs=()
	local pkg confirm grp

	for grp in base base-devel; do
		if LC_ALL=C run_command pacman -Qgq "$grp"; then
			while IFS= read -r pkg; do
				[[ -n "$pkg" ]] && base_group_pkgs["$pkg"]=1
			done <<<"$CMD_OUTPUT"
		fi
	done
	log_message "DEBUG" "Loaded ${#base_group_pkgs[@]} base/base-devel packages as protected from automated action."

	for pkg in "${candidates[@]}"; do
		if [[ -n "${base_group_pkgs[$pkg]:-}" ]]; then
			protected_pkgs+=("$pkg")
			continue
		fi
		if is_ignored "$pkg"; then
			log_message "INFO" "Broken package '$pkg' is on the ignore list — skipping automated heal."
			continue
		fi
		if [[ -n "${OFFICIAL_PKGS[$pkg]:-}" ]]; then
			official_pkgs+=("$pkg")
		elif [[ -n "${AUR_PKGS[$pkg]:-}" ]]; then
			aur_pkgs+=("$pkg")
		else
			log_message "WARN" "Broken package '$pkg' not found in official or AUR caches."
		fi
	done

	if [[ ${#protected_pkgs[@]} -gt 0 ]]; then
		printf '%sBase/base-devel packages flagged (%s) but NEVER auto-touched — handle manually:%s\n' "$WARN" "$label" "$RESET" >&2
		printf '  %s\n' "${protected_pkgs[@]}" >&2
		log_message "WARN" "Excluded ${#protected_pkgs[@]} base/base-devel packages from automated heal (${label}): ${protected_pkgs[*]}"
	fi

	local total_candidates=$((${#official_pkgs[@]} + ${#aur_pkgs[@]}))
	local allow_execution=true

	if ((total_candidates > MAX_AUTO_HEAL_BATCH_SIZE)); then
		if [[ "$FORCE_HEAL_ALL" = true ]]; then
			log_message "WARN" "Ceiling overridden by -I/--force-heal-all ($total_candidates > $MAX_AUTO_HEAL_BATCH_SIZE). Proceeding with mass heal."
		elif [[ "$INTERACTIVE_MODE" = true ]]; then
			printf '\n%sWARNING: %d %s packages flagged for reinstallation/rebuild (exceeds safety threshold of %d).%s\n' \
				"$WARNING" "$total_candidates" "$label" "$MAX_AUTO_HEAL_BATCH_SIZE" "$RESET" >&2
			printf '%sThis scale usually indicates a system upgrade transition. Reinstall anyway in safe batches? (y/N): %s' "$YELLOW" "$RESET" >&2
			read -r confirm
			if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
				allow_execution=false
			fi
		else
			log_message "ERROR" "${total_candidates} ${label} package(s) flagged for automated heal, exceeding safety ceiling of ${MAX_AUTO_HEAL_BATCH_SIZE} — refusing unattended action. Run with -i or -I to override."
			printf '%sRefusing automated action on %s: %d packages exceeds the safety ceiling of %d (use -i or -I to override).%s\n' "$WARN" "$label" "$total_candidates" "$MAX_AUTO_HEAL_BATCH_SIZE" "$RESET" >&2
			allow_execution=false
		fi

		if [[ "$allow_execution" = false ]]; then
			[[ ${#official_pkgs[@]} -gt 0 ]] && {
				printf '%sOfficial (not acted on):%s\n' "$SKY_BLUE" "$RESET" >&2
				printf '  %s\n' "${official_pkgs[@]}" >&2
			}
			[[ ${#aur_pkgs[@]} -gt 0 ]] && {
				printf '%sAUR (not acted on):%s\n' "$MAGENTA" "$RESET" >&2
				printf '  %s\n' "${aur_pkgs[@]}" >&2
			}
			return 0
		fi
	fi

	# Ensure system is synchronized before performing mass reinstallation
	if ! sync_system_preflight; then
		log_message "ERROR" "Preflight sync check failed or was declined — aborting bulk package reinstallation."
		return 1
	fi

	# Reinstall Official packages in chunked batches
	if [[ ${#official_pkgs[@]} -gt 0 ]]; then
		printf '%sOfficial packages (%s) to reinstall (%d total):%s\n' "$SKY_BLUE" "$label" "${#official_pkgs[@]}" "$RESET" >&2
		if [[ "$INTERACTIVE_MODE" = true && "$total_candidates" -le "$MAX_AUTO_HEAL_BATCH_SIZE" ]]; then
			printf '%sProceed to reinstall official packages? (y/N): %s' "$YELLOW" "$RESET" >&2
			read -r confirm
			[[ ! "$confirm" =~ ^[Yy]$ ]] && official_pkgs=()
		fi

		if [[ ${#official_pkgs[@]} -gt 0 ]]; then
			log_message "INFO" "Executing chunked reinstallation of ${#official_pkgs[@]} official packages..."
			local -i offset=0
			while ((offset < ${#official_pkgs[@]})); do
				local -a chunk=("${official_pkgs[@]:offset:REINSTALL_CHUNK_SIZE}")
				offset=$((offset + REINSTALL_CHUNK_SIZE))
				log_message "INFO" "Installing batch chunk ($offset/${#official_pkgs[@]}): ${chunk[*]}"
				if ! run_pacman_install pacman -S --needed --noconfirm "${chunk[@]}"; then
					log_message "ERROR" "Failed to reinstall official chunk: ${chunk[*]}"
				fi
			done
		fi
	fi

	# Rebuild AUR packages
	if [[ ${#aur_pkgs[@]} -gt 0 ]]; then
		printf '%sAUR packages (%s) to rebuild (%d total):%s\n' "$MAGENTA" "$label" "${#aur_pkgs[@]}" "$RESET" >&2
		if [[ "$INTERACTIVE_MODE" = true && "$total_candidates" -le "$MAX_AUTO_HEAL_BATCH_SIZE" ]]; then
			printf '%sProceed to rebuild AUR packages? (y/N): %s' "$YELLOW" "$RESET" >&2
			read -r confirm
			[[ ! "$confirm" =~ ^[Yy]$ ]] && aur_pkgs=()
		fi

		if [[ ${#aur_pkgs[@]} -gt 0 ]]; then
			if [[ "$YAY_AVAILABLE" = true ]]; then
				log_message "INFO" "Rebuilding AUR ${label} packages: ${aur_pkgs[*]}"
				wait_for_pacman_lock
				if ! run_yay -S --rebuild --noconfirm "${aur_pkgs[@]}"; then
					log_message "ERROR" "Failed to rebuild AUR ${label} packages."
				fi
			else
				log_message "WARN" "yay not available, cannot rebuild broken AUR packages (${label}): ${aur_pkgs[*]}"
			fi
		fi
	fi
	return 0
}

heal_broken_packages() {
	_heal_package_batch "verified-missing-files" "${BROKEN_INTEGRITY_PKGS[@]}"

	if [[ ${#STALE_PYTHON_ONLY_PKGS[@]} -gt 0 ]]; then
		if [[ "$HEAL_INTEGRITY" = true ]]; then
			_heal_package_batch "stale-python-dir" "${STALE_PYTHON_ONLY_PKGS[@]}"
		else
			printf '%s %d package(s) merely own a file under a stale Python directory — not necessarily broken. Not acted on; pass -x to enable automated action.%s\n' "$NOTE" "${#STALE_PYTHON_ONLY_PKGS[@]}" "$RESET" >&2
			log_message "INFO" "${#STALE_PYTHON_ONLY_PKGS[@]} stale-python-dir-only package(s) reported but not acted on (pass -x to enable): ${STALE_PYTHON_ONLY_PKGS[*]}"
		fi
	fi
}

# ── Parsing, diagnosis & bounded automated remediation ───────────────────────
parse_target_dependencies() {
	local target="$1" deps
	if ! LC_ALL=C run_command pacman -Qi -- "$target"; then
		log_message "ERROR" "Target package '$target' is not installed or cannot be queried."
		return 1
	fi

	deps=$(printf '%s\n' "$CMD_OUTPUT" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" awk '
        /^Depends On[[:space:]]*:/ {
            sub(/^Depends On[[:space:]]*:[[:space:]]*/, "", $0)
            n = split($0, arr, /[[:space:]]+/)
            for (i = 1; i <= n; i++) {
                if (arr[i] != "" && arr[i] != "None") {
                    print arr[i]
                }
            }
            exit
        }
    ')

	[[ -z "$deps" ]] && return 0
	printf '%s\n' "$deps"
}

auto_rebuild_broken_reverse_deps() {
	local bad_dep_expr="$1"
	local package_owner pkg depends_str

	if ((AUTO_HEAL_ATTEMPTS_USED >= MAX_AUTO_HEAL_ATTEMPTS)); then
		log_message "ERROR" "Automated heal attempt budget (${MAX_AUTO_HEAL_ATTEMPTS}) exhausted for this run — refusing further automated rebuilds of '${bad_dep_expr}'."
		return 1
	fi
	AUTO_HEAL_ATTEMPTS_USED=$((AUTO_HEAL_ATTEMPTS_USED + 1))
	log_message "WARN" "Fixed-point stall identified on constraint: ${bad_dep_expr} (heal attempt ${AUTO_HEAL_ATTEMPTS_USED}/${MAX_AUTO_HEAL_ATTEMPTS})"
	log_message "INFO" "Tracing local system reverse metadata to pinpoint parent owner..."

	package_owner=""
	if ! LC_ALL=C run_command pacman -Dk; then
		while IFS= read -r line; do
			[[ -z "$line" ]] && continue
			if [[ "$line" == *"' dependency for '"* && "$line" == *"${bad_dep_expr}"* ]]; then
				package_owner=$(printf '%s\n' "$line" |
					bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sed -n "s/.*dependency for '\([^']*\)'.*/\1/p")
				[[ -n "${package_owner}" ]] && break
			fi
		done <<<"$CMD_OUTPUT"
	fi

	if [[ -z "${package_owner}" ]]; then
		log_message "INFO" "Falling back to cached per-package depends metadata."
		for pkg in "${!PACKAGE_DEPENDS[@]}"; do
			depends_str="${PACKAGE_DEPENDS[$pkg]}"
			if [[ "$depends_str" == *"${bad_dep_expr}"* ]]; then
				package_owner="$pkg"
				break
			fi
		done
	fi

	if [[ -z "${package_owner}" ]]; then
		log_message "ERROR" "Heuristic tracking engine could not map dependency '${bad_dep_expr}' to an installed package."
		return 1
	fi

	log_message "WARN" "Dependency fault located: installed package '${package_owner}' requires unfulfillable dependency '${bad_dep_expr}'."

	if [[ -n "${AUR_PKGS[${package_owner}]:-}" ]]; then
		log_message "INFO" "Automated heal action: rebuilding AUR package '${package_owner}'..."
		if run_yay -S --rebuild --noconfirm "${package_owner}"; then
			log_message "OK" "Automated AUR rebuild succeeded for '${package_owner}'."
			return 0
		fi
		log_message "ERROR" "Automated AUR rebuild failed for '${package_owner}'."
		return 1
	elif [[ -n "${OFFICIAL_PKGS[${package_owner}]:-}" ]]; then
		log_message "INFO" "Automated heal action: reinstalling official package '${package_owner}'..."
		if run_pacman_install pacman -S --needed --noconfirm "${package_owner}"; then
			log_message "OK" "Automated repo reinstall succeeded for '${package_owner}'."
			return 0
		fi
		log_message "ERROR" "Automated repo reinstall failed for '${package_owner}'."
		return 1
	fi

	log_message "ERROR" "Owner package '${package_owner}' found in neither official nor AUR cache."
	return 1
}

compute_missing_dependencies() {
	MISSING_DEPS_RESULT=()
	local -a missing=()
	local -A missing_set=()
	local line dep_name dep_status target deps exit_code

	if [[ "$ALL_SYSTEM" = true || $# -eq 0 ]]; then
		log_message "INFO" "Checking for missing dependencies (pacman -Dk)."

		if LC_ALL=C run_command pacman -Dk; then
			exit_code=0
		else
			exit_code=$?
		fi

		if [[ $exit_code -eq 0 ]]; then
			log_message "INFO" "pacman -Dk: all dependencies satisfied."
			return 0
		fi

		while IFS= read -r line; do
			[[ -z "$line" ]] && continue
			if [[ "$line" == *"' dependency for '"* ]]; then
				dep_name=$(printf '%s\n' "$line" |
					bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sed -n "s/.*missing '\([^']*\)' dependency for '[^']*'.*/\1/p")
				if [[ -n "$dep_name" ]]; then
					if ! is_ignored "$dep_name"; then
						log_message "DEBUG" "Missing dep (not ignored): '$dep_name'"
						missing_set["$dep_name"]=1
					else
						log_message "DEBUG" "Missing dep (ignored): '$dep_name'"
					fi
				else
					log_message "DEBUG" "pacman -Dk extraction failed: $line"
				fi
			elif [[ "$line" == *"is a missing dependency"* ]]; then
				dep_name=$(printf '%s\n' "$line" |
					bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sed -n "s/.*: '\([^']*\)' is a missing dependency/\1/p")
				if [[ -n "$dep_name" ]]; then
					if ! is_ignored "$dep_name"; then
						log_message "DEBUG" "Missing dep fallback (not ignored): '$dep_name'"
						missing_set["$dep_name"]=1
					else
						log_message "DEBUG" "Missing dep fallback (ignored): '$dep_name'"
					fi
				fi
			fi
		done <<<"$CMD_OUTPUT"

		if [[ ${#missing_set[@]} -eq 0 ]]; then
			log_message "ERROR" "pacman -Dk exited with status ${exit_code} but no missing dependencies were extracted."
			return 1
		fi
	else
		log_message "INFO" "Checking dependencies for target package(s): $*"
		local -a batch_deps=() alt_deps=() batch_unsatisfied=()
		local -A batch_lookup=()
		local batch_fallback=false
		for target in "$@"; do
			deps="$(parse_target_dependencies "$target")" || return 1
			while IFS= read -r dep_name; do
				[[ -z "$dep_name" ]] && continue
				if [[ "$dep_name" == *'|'* ]]; then
					alt_deps+=("$dep_name")
				else
					batch_deps+=("$dep_name")
					batch_lookup["$dep_name"]=1
				fi
			done <<<"$deps"
		done

		if [[ ${#batch_deps[@]} -gt 0 ]]; then
			if LC_ALL=C run_command pacman -T -- "${batch_deps[@]}"; then
				dep_status=0
			else
				dep_status=$?
			fi
			if [[ $dep_status -eq 0 ]]; then
				log_message "DEBUG" "pacman -T batch: all ${#batch_deps[@]} probed dependencies satisfied."
			elif [[ $dep_status -eq 1 || $dep_status -eq 127 ]]; then
				while IFS= read -r dep_name; do
					[[ -z "$dep_name" ]] && continue
					if [[ -z "${batch_lookup[$dep_name]:-}" ]]; then
						log_message "DEBUG" "pacman -T drift ('$dep_name') — reverting to per-token probing."
						batch_fallback=true
						batch_unsatisfied=()
						break
					fi
					batch_unsatisfied+=("$dep_name")
				done <<<"$CMD_OUTPUT"
			else
				log_message "ERROR" "pacman -T target check failed with status: ${dep_status}."
				return 1
			fi
		fi

		if [[ "$batch_fallback" = true ]]; then
			for dep_name in "${batch_deps[@]}"; do
				if run_command pacman -T -- "$dep_name"; then
					dep_status=0
				else
					dep_status=$?
				fi
				if [[ $dep_status -eq 1 || $dep_status -eq 127 ]]; then
					if ! is_ignored "$dep_name"; then
						missing_set["$dep_name"]=1
					fi
				fi
			done
		else
			for dep_name in "${batch_unsatisfied[@]:-}"; do
				[[ -z "$dep_name" ]] && continue
				if ! is_ignored "$dep_name"; then
					missing_set["$dep_name"]=1
				fi
			done
		fi

		for dep_name in "${alt_deps[@]:-}"; do
			[[ -z "$dep_name" ]] && continue
			local alt found=false
			while IFS= read -r alt; do
				[[ -z "$alt" ]] && continue
				if run_command pacman -T -- "$alt"; then
					found=true
					break
				fi
			done < <(printf '%s' "$dep_name" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" tr '|' '\n')
			if [[ "$found" = false ]] && ! is_ignored "$dep_name"; then
				missing_set["$dep_name"]=1
			fi
		done
	fi

	if [[ ${#missing_set[@]} -gt 0 ]]; then
		mapfile -t missing < <(printf "%s\n" "${!missing_set[@]}" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sort)
		log_message "INFO" "Found ${#missing[@]} missing dependencies."
		MISSING_DEPS_RESULT=("${missing[@]}")
	else
		log_message "INFO" "No unignored missing dependencies found."
	fi
	return 0
}

# ── Core loops & execution lifecycle ──────────────────────────────────────────
install_dependencies() {
	local -a deps_to_install=("$@")
	local -a official_deps=() aur_deps=() unresolved_deps=()
	local dep confirm success=0 resolved_dep
	local provider_line provider_lines
	local -a provider_pkgs=()

	check_disk_space || return 1
	[[ ${#deps_to_install[@]} -eq 0 ]] && {
		log_message "INFO" "No dependencies to install."
		return 0
	}

	log_message "INFO" "Preparing to install ${#deps_to_install[@]} dependencies."

	for dep in "${deps_to_install[@]}"; do
		[[ -z "$dep" ]] && continue
		if [[ "$dep" == *'|'* ]]; then
			resolved_dep=""
			while IFS= read -r candidate; do
				candidate="$(trim_whitespace "$candidate")"
				candidate="$(dependency_package_name "$candidate")"
				if [[ -n "${OFFICIAL_PKGS[$candidate]:-}" ]]; then
					resolved_dep="$candidate"
					official_deps+=("$candidate")
					break
				elif [[ -n "${AUR_PKGS[$candidate]:-}" ]]; then
					resolved_dep="$candidate"
					aur_deps+=("$candidate")
					break
				fi
			done < <(printf '%s' "$dep" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" tr '|' '\n')
			if [[ -z "$resolved_dep" ]]; then
				while IFS= read -r candidate; do
					candidate="$(trim_whitespace "$candidate")"
					candidate="$(dependency_package_name "$candidate")"
					if provider_lines="$(resolve_repo_package "$candidate")"; then
						provider_pkgs=()
						while IFS= read -r provider_line; do
							[[ -z "$provider_line" ]] && continue
							provider_pkgs+=("$provider_line")
						done <<<"$provider_lines"
						if [[ ${#provider_pkgs[@]} -gt 0 ]]; then
							resolved_dep="$candidate"
							official_deps+=("${provider_pkgs[@]}")
							break
						fi
					fi
				done < <(printf '%s' "$dep" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" tr '|' '\n')
			fi
			[[ -z "$resolved_dep" ]] && unresolved_deps+=("$dep")
		else
			resolved_dep="$(dependency_package_name "$dep")"
			if [[ -n "${OFFICIAL_PKGS[$resolved_dep]:-}" ]]; then
				official_deps+=("$resolved_dep")
			elif [[ -n "${AUR_PKGS[$resolved_dep]:-}" ]]; then
				aur_deps+=("$resolved_dep")
			else
				provider_pkgs=()
				if provider_lines="$(resolve_repo_package "$resolved_dep")"; then
					while IFS= read -r provider_line; do
						[[ -z "$provider_line" ]] && continue
						provider_pkgs+=("$provider_line")
					done <<<"$provider_lines"
				fi
				if [[ ${#provider_pkgs[@]} -gt 0 ]]; then
					official_deps+=("${provider_pkgs[@]}")
				else
					unresolved_deps+=("$dep")
				fi
			fi
		fi
	done

	if [[ ${#unresolved_deps[@]} -gt 0 ]]; then
		for dep in "${unresolved_deps[@]}"; do
			log_message "WARN" "Dependency '$dep' not found in official or AUR cache — skipping."
		done
		success=1
	fi

	if [[ ${#official_deps[@]} -gt 0 ]]; then
		printf '%sOfficial dependencies to install:%s\n' "$SKY_BLUE" "$RESET" >&2
		printf '  %s\n' "${official_deps[@]}" >&2

		if [[ "$INTERACTIVE_MODE" = true ]]; then
			printf '%sProceed to install official dependencies? (y/N): %s' "$YELLOW" "$RESET" >&2
			read -r confirm
			if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
				log_message "INFO" "User declined official deps."
				official_deps=()
				success=1
			fi
		fi

		if [[ ${#official_deps[@]} -gt 0 ]]; then
			log_message "INFO" "Installing official: ${official_deps[*]}"
			if ! run_pacman_install pacman -S --needed --noconfirm "${official_deps[@]}"; then
				log_message "ERROR" "Failed to install official deps: ${official_deps[*]}"
				success=1
			else
				log_message "INFO" "Official dependencies installed."
			fi
		fi
	fi

	if [[ ${#aur_deps[@]} -gt 0 ]]; then
		printf '%sAUR dependencies to install:%s\n' "$MAGENTA" "$RESET" >&2
		printf '  %s\n' "${aur_deps[@]}" >&2

		if [[ "$YAY_AVAILABLE" = true ]]; then
			if [[ "$INTERACTIVE_MODE" = true ]]; then
				printf '%sProceed to install AUR dependencies? (y/N): %s' "$YELLOW" "$RESET" >&2
				read -r confirm
				if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
					log_message "INFO" "User declined AUR deps."
					aur_deps=()
					success=1
				fi
			fi

			if [[ ${#aur_deps[@]} -gt 0 ]]; then
				log_message "INFO" "Installing AUR: ${aur_deps[*]}"
				wait_for_pacman_lock
				if ! run_yay -S --needed --noconfirm "${aur_deps[@]}"; then
					log_message "ERROR" "Failed to install AUR deps: ${aur_deps[*]}"
					success=1
				else
					log_message "INFO" "AUR dependencies installed."
				fi
			fi
		else
			log_message "WARN" "'yay' not found — cannot install AUR deps: ${aur_deps[*]}"
			success=1
		fi
	fi

	return "$success"
}

process_dependency_closure() {
	log_message "INFO" "Starting dependency closure process."
	local iteration=1 max_iterations=15 fingerprint candidate dep
	local -a current_targets=() missing_deps=()
	local -A seen_missing_fingerprints=()

	if [[ "$ALL_SYSTEM" = true ]]; then
		log_message "INFO" "Checking all installed system packages."
		current_targets=("${!INSTALLED_PKGS[@]}")
	elif [[ ${#TARGET_PKGLIST[@]} -gt 0 ]]; then
		log_message "INFO" "Checking target packages: ${TARGET_PKGLIST[*]}"
		current_targets=("${TARGET_PKGLIST[@]}")
	fi

	last_missing=()

	while ((iteration <= max_iterations)); do
		log_message "INFO" "Closure iteration $iteration."
		if [[ ${#current_targets[@]} -eq 0 && "$ALL_SYSTEM" != true ]]; then
			log_message "INFO" "No targets. Stopping."
			break
		fi

		if [[ "$ALL_SYSTEM" = true ]]; then
			if ! compute_missing_dependencies; then
				log_message "ERROR" "Dependency audit failed during closure iteration $iteration."
				return 1
			fi
		else
			if ! compute_missing_dependencies "${current_targets[@]}"; then
				log_message "ERROR" "Dependency audit failed during closure iteration $iteration."
				return 1
			fi
		fi

		missing_deps=("${MISSING_DEPS_RESULT[@]}")

		if [[ ${#missing_deps[@]} -eq 0 ]]; then
			log_message "INFO" "No missing dependencies in iteration $iteration. Closure reached."
			last_missing=()
			break
		fi

		fingerprint="$(printf "%s\n" "${missing_deps[@]}" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sort | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sha256sum | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" cut -d' ' -f1)"
		if [[ -n "${seen_missing_fingerprints[$fingerprint]:-}" ]]; then
			log_message "WARN" "Identical missing-dep set seen previously — cycle or unresolvable deps detected."

			local healed=false
			for dep in "${missing_deps[@]}"; do
				if [[ "$dep" == *"="* ]]; then
					log_message "INFO" "Stall isolated on version restriction: ${dep}"
					if auto_rebuild_broken_reverse_deps "${dep}"; then
						healed=true
						break
					fi
				fi
			done

			if [[ "$healed" = true ]]; then
				log_message "OK" "Metadata discrepancy addressed. Re-evaluating database (heal budget: ${AUTO_HEAL_ATTEMPTS_USED}/${MAX_AUTO_HEAL_ATTEMPTS})..."
				cache_package_lists
				cache_package_groups
				((iteration++))
				continue
			fi

			log_message "ERROR" "Automated healing unavailable or exhausted. Halting closure to prevent regression."
			last_missing=("${missing_deps[@]}")
			break
		fi
		seen_missing_fingerprints["$fingerprint"]=1

		last_missing=("${missing_deps[@]}")
		log_message "INFO" "Found ${#missing_deps[@]} missing deps in iteration $iteration: ${missing_deps[*]}"

		if ! install_dependencies "${missing_deps[@]}"; then
			log_message "ERROR" "Installation failed or was incomplete in iteration $iteration. Stopping."
			break
		fi

		log_message "INFO" "Re-caching package lists after installation."
		cache_package_lists
		cache_package_groups
		current_targets=()
		local resolved
		for dep in "${missing_deps[@]}"; do
			if [[ "$dep" == *'|'* ]]; then
				while IFS= read -r candidate; do
					candidate="$(dependency_package_name "$(trim_whitespace "$candidate")")"
					if resolved="$(resolve_installed_provider "$candidate")"; then
						current_targets+=("$resolved")
						break
					fi
				done < <(printf '%s' "$dep" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" tr '|' '\n')
			else
				candidate="$(dependency_package_name "$dep")"
				if resolved="$(resolve_installed_provider "$candidate")"; then
					current_targets+=("$resolved")
				fi
			fi
		done
		((iteration++))
	done

	if ((iteration > max_iterations)); then
		log_message "WARN" "Max iterations (${max_iterations}) reached — closure may be incomplete."
	fi
	log_message "INFO" "Dependency closure finished."
	return 0
}

prompt_ignore_lists() {
	log_message "INFO" "Prompting for interactive ignore lists..."
	local selected_pkgs selected_groups all_groups user_pkgs user_groups old_ifs
	local -a tmp_pkgs=() tmp_groups=()
	local pkg group

	if command -v fzf >/dev/null 2>&1 && [[ -t 0 ]]; then
		printf -- "--- Interactive Ignore Selection ---\n" >&2
		selected_pkgs=$(printf "%s\n" "${!INSTALLED_PKGS[@]}" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sort |
			bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" fzf --multi --prompt="Ignore Package: " --header="TAB to mark, ENTER when done" 2>/dev/null || true)
		if [[ -n "$selected_pkgs" ]]; then
			mapfile -t tmp_pkgs <<<"$selected_pkgs"
			CUSTOM_IGNORE_PKGS+=("${tmp_pkgs[@]}")
		fi

		all_groups=$(printf '%s\n' "${PACKAGE_GROUPS[@]}" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" tr ' ' '\n' | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sed '/^$/d' | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sort -u)
		selected_groups=$(printf "%s\n" "$all_groups" |
			bounded_exec "${EXTERNAL_TIMEOUT_SECONDS}" fzf --multi --prompt="Ignore Group: " --header="TAB to mark, ENTER when done" 2>/dev/null || true)
		if [[ -n "$selected_groups" ]]; then
			mapfile -t tmp_groups <<<"$selected_groups"
			CUSTOM_IGNORE_GROUPS+=("${tmp_groups[@]}")
		fi
		printf -- "------------------------------------\n" >&2
	else
		log_message "INFO" "fzf not available — using fallback prompts."

		local cur_pkgs_str="none"
		if [[ ${#DEFAULT_IGNORE_PKGS[@]} -gt 0 || ${#CUSTOM_IGNORE_PKGS[@]} -gt 0 ]]; then
			printf -v cur_pkgs_str '%s,' "${DEFAULT_IGNORE_PKGS[@]:-}" "${CUSTOM_IGNORE_PKGS[@]:-}"
			cur_pkgs_str="${cur_pkgs_str%,}"
		fi
		printf "Additional packages to ignore (comma-separated) [%s]: " "$cur_pkgs_str" >&2
		read -r user_pkgs
		if [[ -n "$user_pkgs" ]]; then
			old_ifs="$IFS"
			IFS=',' read -r -a tmp_pkgs <<<"$user_pkgs"
			IFS="$old_ifs"
			for pkg in "${tmp_pkgs[@]}"; do
				pkg="$(trim_whitespace "$pkg")"
				[[ -n "$pkg" ]] && CUSTOM_IGNORE_PKGS+=("$pkg")
			done
		fi

		local cur_groups_str="none"
		if [[ ${#CUSTOM_IGNORE_GROUPS[@]} -gt 0 ]]; then
			printf -v cur_groups_str '%s,' "${CUSTOM_IGNORE_GROUPS[@]:-}"
			cur_groups_str="${cur_groups_str%,}"
		fi
		printf "Additional groups to ignore (comma-separated) [%s]: " "$cur_groups_str" >&2
		read -r user_groups
		if [[ -n "$user_groups" ]]; then
			old_ifs="$IFS"
			IFS=',' read -r -a tmp_groups <<<"$user_groups"
			IFS="$old_ifs"
			for group in "${tmp_groups[@]}"; do
				group="$(trim_whitespace "$group")"
				[[ -n "$group" ]] && CUSTOM_IGNORE_GROUPS+=("$group")
			done
		fi
	fi
	log_message "INFO" "Ignore lists finalised."
}

detect_pending_upgrades() {
	log_message "INFO" "Checking for pending upgrades (pacman -Qu)..."
	local line pkg_name
	PENDING_UPGRADES_COUNT=0
	PENDING_PYTHON_UPGRADE=false

	if LC_ALL=C run_command pacman -Qu; then
		:
	else
		log_message "DEBUG" "pacman -Qu exited nonzero — counting captured output."
	fi
	while IFS= read -r line; do
		[[ -z "$line" ]] && continue
		PENDING_UPGRADES_COUNT=$((PENDING_UPGRADES_COUNT + 1))
		pkg_name="${line%% *}"
		if [[ "$pkg_name" == "python" ]]; then
			PENDING_PYTHON_UPGRADE=true
		fi
	done <<<"$CMD_OUTPUT"
	if ((PENDING_UPGRADES_COUNT == 0)); then
		log_message "INFO" "System is fully up to date with sync repositories."
	else
		log_message "INFO" "Pending upgrades: ${PENDING_UPGRADES_COUNT} package(s)${PENDING_PYTHON_UPGRADE:+, including 'python'}."
	fi
	return 0
}

deep_integrity_audit() {
	if [[ "$DEEP_INTEGRITY" != true ]]; then
		return 0
	fi
	log_message "WARN" "Deep integrity audit enabled (pacman -Qkk) — hashing every tracked file..."
	local line pkg exit_code=0
	local -a findings=()
	if LC_ALL=C run_command pacman -Qkk; then
		exit_code=0
	else
		exit_code=$?
	fi
	if [[ $exit_code -ne 0 && $exit_code -ne 1 ]]; then
		log_message "WARN" "pacman -Qkk exited ${exit_code}. Reporting captured results."
	fi
	while IFS= read -r line; do
		[[ -z "$line" ]] && continue
		if [[ "$line" == *" altered files"* && "$line" != *" 0 altered files"* ]]; then
			pkg="${line%%:*}"
			if [[ "$pkg" =~ ^[a-z0-9@._+-]+$ ]]; then
				findings+=("$pkg")
			fi
		fi
	done <<<"$CMD_OUTPUT"
	if [[ ${#findings[@]} -gt 0 ]]; then
		mapfile -t DEEP_INTEGRITY_FINDINGS < <(printf "%s\n" "${findings[@]}" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sort -u)
		log_message "WARN" "Deep audit: ${#DEEP_INTEGRITY_FINDINGS[@]} package(s) with altered files: ${DEEP_INTEGRITY_FINDINGS[*]}"
	else
		log_message "OK" "Deep audit: no altered-file findings."
		DEEP_INTEGRITY_FINDINGS=()
	fi
	return 0
}

report_orphans() {
	if [[ "$REPORT_ORPHANS" != true ]]; then
		return 0
	fi
	log_message "INFO" "Checking for orphaned packages (pacman -Qdtq)..."
	local pkg
	if ! LC_ALL=C run_command pacman -Qdtq; then
		ORPHAN_PKGS=()
		return 0
	fi
	local -a found=()
	while IFS= read -r pkg; do
		[[ -z "$pkg" ]] && continue
		if [[ "$pkg" =~ ^[a-z0-9@._+-]+$ ]]; then
			found+=("$pkg")
		fi
	done <<<"$CMD_OUTPUT"
	if [[ ${#found[@]} -gt 0 ]]; then
		mapfile -t ORPHAN_PKGS < <(printf "%s\n" "${found[@]}" | bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" sort -u)
		log_message "INFO" "Orphan report: ${#ORPHAN_PKGS[@]} package(s) orphaned."
	else
		ORPHAN_PKGS=()
	fi
	return 0
}

report_deep_integrity_findings() {
	if [[ ${#DEEP_INTEGRITY_FINDINGS[@]} -eq 0 ]]; then
		return 0
	fi
	printf '%sDeep integrity findings (altered/corrupted files, -e):%s\n' "$WARN" "$RESET"
	printf '  %s\n' "${DEEP_INTEGRITY_FINDINGS[@]}"
	printf '%sReinstall to restore tracked content:%s\n' "$GREEN" "$RESET"
	printf '  %s%s -S --needed %s%s\n' "$CAT" "sudo pacman" "${DEEP_INTEGRITY_FINDINGS[*]}" "$RESET"
	printf "\n"
	return 0
}

report_orphan_findings() {
	if [[ ${#ORPHAN_PKGS[@]} -eq 0 ]]; then
		return 0
	fi
	printf '%sOrphaned packages (-o):%s\n' "$BLUE" "$RESET"
	printf '  %s\n' "${ORPHAN_PKGS[@]}"
	printf '%sRemove orphans:%s\n' "$GREEN" "$RESET"
	printf '  %s%s %s%s\n' "$CAT" "sudo pacman -Rns" "${ORPHAN_PKGS[*]}" "$RESET"
	printf "\n"
	return 0
}

emit_final_verdict() {
	printf '%s— %s v%s —%s\n' "$BLUE" "${APP_NAME}" "${APP_VERSION}" "$RESET"
	if [[ "${STRICT_EXIT}" = true && ${#last_missing[@]} -gt 0 ]]; then
		log_message "INFO" "Strict exit mode (-r): exiting 2 with ${#last_missing[@]} unresolved missing dependency(ies)."
		exit 2
	fi
	exit 0
}

# ── Arguments parsing & help ──────────────────────────────────────────────────
parse_arguments() {
	log_message "INFO" "Parsing arguments: $*"
	[[ "${1:-}" == "--help" || "${1:-}" == "-h" ]] && {
		print_help
		exit 0
	}
	[[ "${1:-}" == "--version" ]] && {
		print_version
		exit 0
	}

	local opt packages_arg="" groups_arg=""
	local -a tmp_pkgs=() tmp_groups=()
	local old_ifs
	OPTIND=1

	while getopts ":aieoprk:g:l:hdfxIV" opt; do
		case "$opt" in
		a)
			ALL_SYSTEM=true
			log_message "INFO" "-a (ALL_SYSTEM) set."
			;;
		i)
			INTERACTIVE_MODE=true
			log_message "INFO" "-i (INTERACTIVE_MODE) set."
			;;
		p)
			PROMPT_IGNORE=true
			log_message "INFO" "-p (PROMPT_IGNORE) set."
			;;
		f)
			FIX_KEYS=true
			log_message "INFO" "-f (FIX_KEYS) set."
			;;
		x)
			HEAL_INTEGRITY=true
			log_message "INFO" "-x (HEAL_INTEGRITY) set."
			;;
		I)
			FORCE_HEAL_ALL=true
			log_message "INFO" "-I (FORCE_HEAL_ALL) set — bypassing auto-heal ceiling."
			;;
		e)
			DEEP_INTEGRITY=true
			log_message "INFO" "-e (DEEP_INTEGRITY) set."
			;;
		o)
			REPORT_ORPHANS=true
			log_message "INFO" "-o (REPORT_ORPHANS) set."
			;;
		r)
			STRICT_EXIT=true
			log_message "INFO" "-r (STRICT_EXIT) set."
			;;
		k)
			packages_arg="$OPTARG"
			log_message "INFO" "-k: '$packages_arg'"
			;;
		g)
			groups_arg="$OPTARG"
			log_message "INFO" "-g: '$groups_arg'"
			;;
		l)
			LOGFILE="$OPTARG"
			log_message "INFO" "-l: '$LOGFILE'"
			;;
		d)
			DEBUG_MODE=true
			log_message "INFO" "Debug mode enabled."
			;;
		V)
			print_version
			exit 0
			;;
		h)
			print_help
			exit 0
			;;
		\?)
			log_message "ERROR" "Invalid option: -$OPTARG"
			print_help >&2
			exit 1
			;;
		:)
			log_message "ERROR" "Option -$OPTARG requires an argument."
			print_help >&2
			exit 1
			;;
		esac
	done
	shift $((OPTIND - 1))

	if [[ -n "$packages_arg" ]]; then
		old_ifs="$IFS"
		IFS=',' read -r -a tmp_pkgs <<<"$packages_arg"
		IFS="$old_ifs"
		for pkg in "${tmp_pkgs[@]}"; do [[ -n "$pkg" ]] && CUSTOM_IGNORE_PKGS+=("$pkg"); done
	fi

	if [[ -n "$groups_arg" ]]; then
		old_ifs="$IFS"
		IFS=',' read -r -a tmp_groups <<<"$groups_arg"
		IFS="$old_ifs"
		for group in "${tmp_groups[@]}"; do [[ -n "$group" ]] && CUSTOM_IGNORE_GROUPS+=("$group"); done
	fi

	if [[ "$#" -gt 0 ]]; then
		TARGET_PKGLIST=("$@")
		ALL_SYSTEM=false
		log_message "INFO" "Target packages: ${TARGET_PKGLIST[*]}"
	elif [[ "$ALL_SYSTEM" = false ]]; then
		ALL_SYSTEM=true
		log_message "INFO" "No target packages supplied — defaulting to all installed packages."
	fi
}

print_version() {
	printf '%s v%s\n' "${APP_NAME}" "${APP_VERSION}"
}

print_help() {
	cat <<EOF_HELP
Usage: ${0##*/} [OPTIONS] [package1 package2 ...]
Checks for missing dependencies and audits file integrity on Arch Linux.
Version: ${APP_VERSION}

Options:
  -a             Check ALL installed system packages (default if no targets specified).
  -i             Interactive mode: prompt before reinstalling dependencies or healing packages.
  -I             Force bulk heal: override safety batch ceiling (${MAX_AUTO_HEAL_BATCH_SIZE}) unattended.
  -p             Prompt mode: interactive ignore-list selection (fzf or fallback).
  -k <pkgs>      Comma-separated packages to always ignore.
  -g <groups>    Comma-separated package groups to always ignore.
  -l <logfile>   Custom log file path (auto-rotates at 10 MiB).
  -f             Enable keyring repair protocol.
  -x             Enable automated heal for packages merely owning files in stale Python directories.
  -e             Deep integrity audit (pacman -Qkk): hashes every tracked file (report-only).
  -o             Orphan report (pacman -Qdtq): lists unneeded dependencies.
  -r             Strict exit codes: exits 2 if unresolvable missing dependencies persist.
  -d             Enable debug logging.
  -V             Show version and exit.
  -h             Show this help and exit.

Exit codes:
  0              Success / Dependencies satisfied.
  2              (-r only) Finished with unresolved dependencies.
  1/130          Fatal script error / Interrupted.
EOF_HELP
}

# ── Main entrypoint ────────────────────────────────────────────────────────────
main() {
	SCRIPT_ARGS=("$@")

	parse_arguments "$@"
	require_root

	prepare_log_dir

	log_message "INFO" "${APP_NAME} v${APP_VERSION} starting."

	TMP_DIR="$(bounded_exec "${SHORT_EXTERNAL_TIMEOUT_SECONDS}" mktemp -d -t "${APP_NAME}-XXXXXX")"
	[[ -d "${TMP_DIR:-}" ]] || {
		log_message "ERROR" "Failed to create TMP_DIR."
		exit 1
	}

	check_requirements
	if LC_ALL=C run_command pacman-conf IgnorePkg; then
		mapfile -t PACMAN_CONF_IGNORE_PKGS < <(printf '%s' "$CMD_OUTPUT" | grep -v '^[[:space:]]*$' || true)
		log_message "INFO" "Loaded ${#PACMAN_CONF_IGNORE_PKGS[@]} package(s) from pacman.conf's IgnorePkg."
	fi

	wait_for_pacman_lock
	refresh_pacman_databases
	cache_package_lists
	cache_package_groups

	detect_pending_upgrades
	deep_integrity_audit

	[[ "$PROMPT_IGNORE" = true ]] && prompt_ignore_lists

	audit_system_integrity
	heal_broken_packages

	if ! process_dependency_closure; then
		log_message "FATAL" "Dependency closure aborted due to an audit failure."
		exit 1
	fi

	report_orphans

	log_message "INFO" "Generating final report."
	local -a final_missing=("${last_missing[@]}")

	printf '\n%s## Dependency Check Summary ##%s\n' "$GREEN" "$RESET"

	if [[ ${#final_missing[@]} -eq 0 ]]; then
		printf '%s All dependencies satisfied — no further action needed.%s\n' "$OK" "$RESET"
		if ((PENDING_UPGRADES_COUNT > 0)); then
			printf '%sNote: %d package upgrade(s) pending%s — run "pacman -Syu" to sync.%s\n' \
				"$BLUE" "$PENDING_UPGRADES_COUNT" \
				"${PENDING_PYTHON_UPGRADE:+ (including 'python')}" "$RESET"
		fi
		report_deep_integrity_findings
		report_orphan_findings
		log_message "INFO" "Script finished successfully — no missing deps."
		emit_final_verdict
	fi

	printf '%sFound %d unresolved missing dependencies:%s\n' "$WARN" "${#final_missing[@]}" "$RESET"
	for dep in "${final_missing[@]}"; do
		printf '  %s- %s%s\n' "$WARN" "$dep" "$RESET"
	done
	printf "\n"

	local -a official_only=() aur_only=() unknown_only=()
	local needs_yay=false dep_name_raw base_dep_name provider_line
	local -a provider_pkgs=()

	for dep_name_raw in "${final_missing[@]}"; do
		base_dep_name="$(dependency_package_name "$dep_name_raw")"
		if [[ -n "${OFFICIAL_PKGS[$base_dep_name]:-}" ]]; then
			official_only+=("$base_dep_name")
		elif [[ -n "${AUR_PKGS[$base_dep_name]:-}" ]]; then
			aur_only+=("$base_dep_name")
			needs_yay=true
		else
			provider_pkgs=()
			if provider_lines="$(resolve_repo_package "$base_dep_name")"; then
				while IFS= read -r provider_line; do
					[[ -z "$provider_line" ]] && continue
					provider_pkgs+=("$provider_line")
				done <<<"$provider_lines"
			fi
			if [[ ${#provider_pkgs[@]} -gt 0 ]]; then
				official_only+=("${provider_pkgs[@]}")
			else
				unknown_only+=("$base_dep_name")
			fi
		fi
	done

	[[ ${#official_only[@]} -gt 0 ]] && {
		printf '%sOfficial:%s\n' "$SKY_BLUE" "$RESET"
		printf '  %s\n' "${official_only[@]}"
	}
	[[ ${#aur_only[@]} -gt 0 ]] && {
		printf '%sAUR:%s\n' "$MAGENTA" "$RESET"
		printf '  %s\n' "${aur_only[@]}"
	}
	[[ ${#unknown_only[@]} -gt 0 ]] && {
		printf '%sUnknown (not in official/AUR caches):%s\n' "$WARN" "$RESET"
		printf '  %s\n' "${unknown_only[@]}"
	}
	printf "\n"

	if [[ "$needs_yay" = true && "$YAY_AVAILABLE" = true ]]; then
		printf '%sInstall all missing (official + AUR):%s\n' "$GREEN" "$RESET"
		local cmd="yay -S --needed"
		for dep in "${official_only[@]}" "${aur_only[@]}"; do cmd+=" '$dep'"; done
		printf '  %s%s%s\n' "$CAT" "$cmd" "$RESET"
	else
		if [[ ${#official_only[@]} -gt 0 ]]; then
			printf '%sInstall official missing:%s\n' "$GREEN" "$RESET"
			local cmd="sudo pacman -S --needed"
			for dep in "${official_only[@]}"; do cmd+=" '$dep'"; done
			printf '  %s%s%s\n' "$CAT" "$cmd" "$RESET"
		fi
	fi

	report_deep_integrity_findings
	report_orphan_findings
	log_message "INFO" "Script finished."
	emit_final_verdict
}

main "$@"