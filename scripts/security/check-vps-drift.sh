#!/bin/sh
# check-vps-drift.sh - read-only drift check of the chat VPS (a Docker Compose host).
#
# This is the restore gate of the `chat-server` asset in security/security-inventory.yaml.
# Run it on the VPS after a restore from a snapshot and before any traffic is allowed. It
# compares the host with what infra/contabo-chat-stack/ says it should be, and it automates
# the standing pgAdmin check of the post-snapshot rebuild runbook
# (davintrade-webchat-stack/POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md, section 1.1).
#
#   sh scripts/security/check-vps-drift.sh --min-node-v22 22.23.5
#   sh scripts/security/check-vps-drift.sh --min-node-v22 22.23.5 --format json
#
# Checks (each ends in pass, fail or error):
#   containers    the running containers are exactly the three of docker-compose.yml
#                 (socket_chat_server, redis_broker, ai_bot_worker)
#   node-version  `node -v` inside socket_chat_server and ai_bot_worker is at or above the floor
#   pgadmin       no pgAdmin container, image, package, unit, process or listening port
#   bindings      redis_broker (6379) and socket_chat_server (3001) are published on 127.0.0.1
#                 only, never on a wildcard address
# The update summary (unattended-upgrades on the host, the Alpine release and the package
# count of each container) is information, not a verdict.
#
# Exit codes: 0 no drift; 1 drift found; 2 a check could not be made, or a usage error.
# A check that cannot be made is an error and never a pass: "docker said permission denied"
# is not a clean result.
#
# It is read-only by construction. It starts nothing, stops nothing, changes no file, opens no
# network connection and never uses sudo. The only commands it runs: docker (ps, images, port,
# and exec of `node -v`, `cat /etc/alpine-release` and `apk info`), ss or netstat, ps,
# dpkg-query, pip3 list, systemctl (list-units, is-enabled, is-active), apt-get -s (a
# simulation) and stat. Its output carries verdicts and address classes (loopback, wildcard,
# other), never an address, so it can be pasted into a chat or an issue.
#
# Text is matched with shell patterns, not pipelines, to keep the number of processes small.

set -u
set -f
LC_ALL=C
export LC_ALL

NL='
'
PIPE='|'
EXPECTED_DEFAULT='socket_chat_server redis_broker ai_bot_worker'
NODE_CONTAINERS='socket_chat_server ai_bot_worker'
BIND_CHECKS='redis_broker:6379 socket_chat_server:3001'
PGADMIN_PORTS='5050 5051'

usage() {
  cat <<'EOF'
Usage: sh check-vps-drift.sh --min-node-v22 X.Y.Z [options]

Read-only drift check of the chat VPS (a Docker Compose host).

Options:
  --min-node-v22 X.Y.Z   the Node.js 22 floor (required)
  --min-node-v24 X.Y.Z   the Node.js 24 floor (needed only when a container runs Node 24)
  --compose-file FILE    take the expected container names from this Compose file
                         (default: socket_chat_server, redis_broker, ai_bot_worker)
  --format text|json     output format (default text)
  -h, --help             this text

Checks: containers, node-version, pgadmin, bindings. The update summary is information.
Exit codes: 0 no drift, 1 drift found, 2 a check could not be made or a usage error.
Run it as root when Docker reports "permission denied".
EOF
}

fail_usage() {
  echo "error: $1" >&2
  echo "Run with --help for the usage." >&2
  exit 2
}

# --- text helpers (builtins only) ---------------------------------------------------------

# X.Y.Z made of digits only
is_version() {
  case "$1" in
    '' | *[!0-9.]*) return 1 ;;
    [0-9]*.[0-9]*.[0-9]*) ;;
    *) return 1 ;;
  esac
  iv_rest=${1#*.}
  iv_second=${iv_rest%%.*}
  iv_third=${iv_rest#*.}
  case "$iv_third" in
    '' | *.*) return 1 ;;
  esac
  [ -n "$iv_second" ] && [ -n "${1%%.*}" ]
}

# $1 >= $2, both X.Y.Z compared as numbers
version_ge() {
  va=$1
  vb=$2
  a1=${va%%.*}
  va=${va#*.}
  a2=${va%%.*}
  a3=${va#*.}
  b1=${vb%%.*}
  vb=${vb#*.}
  b2=${vb%%.*}
  b3=${vb#*.}
  [ "$a1" -gt "$b1" ] && return 0
  [ "$a1" -lt "$b1" ] && return 1
  [ "$a2" -gt "$b2" ] && return 0
  [ "$a2" -lt "$b2" ] && return 1
  [ "$a3" -ge "$b3" ]
}

# true when the text $1 mentions pgadmin, in any case
mentions_pgadmin() {
  case $1 in
    *[Pp][Gg][Aa][Dd][Mm][Ii][Nn]*) return 0 ;;
  esac
  return 1
}

# true when $2 is one whole line of the multi-line text $1
has_line() {
  case "$NL$1$NL" in
    *"$NL$2$NL"*) return 0 ;;
  esac
  return 1
}

# COUNT: the lines of $1 that start with $2 (with an empty $2: the lines that are not empty)
count_lines() {
  cl_n=0
  while IFS= read -r cl_line; do
    case $cl_line in
      "$2"*) [ -n "$cl_line" ] && cl_n=$((cl_n + 1)) ;;
    esac
  done <<EOF
$1
EOF
  COUNT=$cl_n
}

# CLEAN: one line of plain text; a newline becomes a space, the record separator a slash
clean() {
  cn_text=$1
  while :; do
    case $cn_text in
      *"$NL"*) cn_text=${cn_text%%"$NL"*}' '${cn_text#*"$NL"} ;;
      *"$PIPE"*) cn_text=${cn_text%%"$PIPE"*}/${cn_text#*"$PIPE"} ;;
      *) break ;;
    esac
  done
  CLEAN=$cn_text
}

# CLASS: loopback, wildcard or other, for the host part of HOST:PORT, [HOST]:PORT or :::PORT
class_of() {
  co_host=${1%:*}
  co_host=${co_host#\[}
  co_host=${co_host%\]}
  case $co_host in
    127.0.0.1) CLASS=loopback ;;
    0.0.0.0 | '::' | '*' | '') CLASS=wildcard ;;
    *) CLASS=other ;;
  esac
}

# --- arguments ----------------------------------------------------------------------------

MIN22=''
MIN24=''
COMPOSE=''
FORMAT='text'

while [ $# -gt 0 ]; do
  case "$1" in
    --min-node-v22)
      [ $# -ge 2 ] || fail_usage '--min-node-v22 needs a value'
      MIN22=$2
      shift 2
      ;;
    --min-node-v22=*)
      MIN22=${1#*=}
      shift
      ;;
    --min-node-v24)
      [ $# -ge 2 ] || fail_usage '--min-node-v24 needs a value'
      MIN24=$2
      shift 2
      ;;
    --min-node-v24=*)
      MIN24=${1#*=}
      shift
      ;;
    --compose-file)
      [ $# -ge 2 ] || fail_usage '--compose-file needs a value'
      COMPOSE=$2
      shift 2
      ;;
    --compose-file=*)
      COMPOSE=${1#*=}
      shift
      ;;
    --format)
      [ $# -ge 2 ] || fail_usage '--format needs a value'
      FORMAT=$2
      shift 2
      ;;
    --format=*)
      FORMAT=${1#*=}
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*) fail_usage 'unknown argument' ;;
    *) fail_usage 'unexpected argument' ;;
  esac
done

[ -n "$MIN22" ] || fail_usage '--min-node-v22 is required'
is_version "$MIN22" || fail_usage '--min-node-v22 must look like 22.23.5'
if [ -n "$MIN24" ]; then
  is_version "$MIN24" || fail_usage '--min-node-v24 must look like 24.22.3'
fi
case "$FORMAT" in
  text | json) ;;
  *) fail_usage '--format must be text or json' ;;
esac

EXPECTED=$EXPECTED_DEFAULT
if [ -n "$COMPOSE" ]; then
  [ -r "$COMPOSE" ] || fail_usage 'the Compose file cannot be read'
  EXPECTED=''
  while IFS= read -r cf_line || [ -n "$cf_line" ]; do
    # a commented-out line names nothing
    cf_first=''
    for cf_first in $cf_line; do break; done
    case $cf_first in
      '#'*) continue ;;
    esac
    case $cf_line in
      *container_name:*)
        cf_name=${cf_line#*container_name:}
        cf_name=${cf_name%%#*}
        for cf_word in $cf_name; do
          cf_word=${cf_word#\"}
          cf_word=${cf_word%\"}
          cf_word=${cf_word#\'}
          cf_word=${cf_word%\'}
          EXPECTED="${EXPECTED}${EXPECTED:+ }$cf_word"
        done
        ;;
    esac
  done <"$COMPOSE"
  [ -n "$EXPECTED" ] || fail_usage 'the Compose file names no container_name'
fi

# --- results ----------------------------------------------------------------------------------

FAILS=0
ERRORS=0
RESULTS=''

# record ID STATUS DETAIL
record() {
  clean "$3"
  RESULTS="${RESULTS}$1|$2|${CLEAN}${NL}"
  case "$2" in
    fail) FAILS=$((FAILS + 1)) ;;
    error) ERRORS=$((ERRORS + 1)) ;;
  esac
}

# --- what the host can tell us ---------------------------------------------------------------------

DOCKER_OK=0
DOCKER_WHY=''
RUNNING=''
if command -v docker >/dev/null 2>&1; then
  if RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null); then
    DOCKER_OK=1
  else
    DOCKER_WHY='docker is not usable here (permission denied or the daemon is down); run this script as root, for example with sudo'
  fi
else
  DOCKER_WHY='docker is not installed on this host'
fi

# the host listener table: LISTENERS is the raw answer, LISTEN_ADDRS its local addresses
LISTENER_OK=0
LISTENERS=''
LISTEN_ADDRS=''
if command -v ss >/dev/null 2>&1; then
  if LISTENERS=$(ss -ltnp 2>/dev/null); then
    LISTENER_OK=1
    while IFS= read -r ls_line; do
      set -- $ls_line
      [ "${1:-}" = LISTEN ] && LISTEN_ADDRS="${LISTEN_ADDRS}${LISTEN_ADDRS:+ }${4:-}"
    done <<EOF
$LISTENERS
EOF
  fi
elif command -v netstat >/dev/null 2>&1; then
  if LISTENERS=$(netstat -ltn 2>/dev/null); then
    LISTENER_OK=1
    while IFS= read -r ls_line; do
      set -- $ls_line
      [ "${6:-}" = LISTEN ] && LISTEN_ADDRS="${LISTEN_ADDRS}${LISTEN_ADDRS:+ }${4:-}"
    done <<EOF
$LISTENERS
EOF
  fi
fi

# --- check: containers ------------------------------------------------------------------------------

check_containers() {
  if [ "$DOCKER_OK" != 1 ]; then
    record containers error "$DOCKER_WHY"
    return 0
  fi
  cc_missing=''
  for cc_want in $EXPECTED; do
    has_line "$RUNNING" "$cc_want" || cc_missing="${cc_missing}${cc_missing:+ }$cc_want"
  done
  cc_unexpected=''
  for cc_have in $RUNNING; do
    case " $EXPECTED " in
      *" $cc_have "*) ;;
      *) cc_unexpected="${cc_unexpected}${cc_unexpected:+ }$cc_have" ;;
    esac
  done
  if [ -z "$cc_missing" ] && [ -z "$cc_unexpected" ]; then
    set -- $EXPECTED
    record containers pass "$# of $# expected containers are running, none unexpected"
    return 0
  fi
  cc_detail=''
  [ -z "$cc_missing" ] || cc_detail="missing: $cc_missing"
  [ -z "$cc_unexpected" ] || cc_detail="${cc_detail}${cc_detail:+; }unexpected: $cc_unexpected"
  record containers fail "$cc_detail"
}

# --- check: node-version ----------------------------------------------------------------------------

check_node() {
  if [ "$DOCKER_OK" != 1 ]; then
    record node-version error "$DOCKER_WHY"
    return 0
  fi
  cn_ok=''
  cn_bad=''
  cn_err=''
  for cn_c in $NODE_CONTAINERS; do
    if ! cn_out=$(docker exec "$cn_c" node -v 2>/dev/null); then
      cn_err="${cn_err}${cn_err:+; }$cn_c: node -v failed"
      continue
    fi
    cn_ver=${cn_out#v}
    cn_ver=${cn_ver%%[!0-9.]*}
    if ! is_version "$cn_ver"; then
      cn_err="${cn_err}${cn_err:+; }$cn_c: the answer is not a version"
      continue
    fi
    cn_major=${cn_ver%%.*}
    case "$cn_major" in
      22) cn_floor=$MIN22 ;;
      24) cn_floor=$MIN24 ;;
      *) cn_floor='' ;;
    esac
    if [ -z "$cn_floor" ]; then
      cn_bad="${cn_bad}${cn_bad:+; }$cn_c v$cn_ver has no floor for line $cn_major"
    elif version_ge "$cn_ver" "$cn_floor"; then
      cn_ok="${cn_ok}${cn_ok:+, }$cn_c v$cn_ver"
    else
      cn_bad="${cn_bad}${cn_bad:+; }$cn_c v$cn_ver is below $cn_floor"
    fi
  done
  if [ -n "$cn_bad" ]; then
    record node-version fail "${cn_bad}${cn_err:+; could not read: $cn_err}"
  elif [ -n "$cn_err" ]; then
    record node-version error "$cn_err"
  else
    record node-version pass "$cn_ok (at or above the floor)"
  fi
}

# --- check: pgadmin ----------------------------------------------------------------------------------

PG_HITS=''
PG_UNREAD=''

pg_hit() {
  case ", $PG_HITS, " in
    *", $1, "*) return 0 ;;
  esac
  PG_HITS="${PG_HITS}${PG_HITS:+, }$1"
}

pg_unread() {
  PG_UNREAD="${PG_UNREAD}${PG_UNREAD:+, }$1"
}

check_pgadmin() {
  if [ "$DOCKER_OK" = 1 ]; then
    if pg_out=$(docker ps -a --format '{{.Names}} {{.Image}}' 2>/dev/null); then
      ! mentions_pgadmin "$pg_out" || pg_hit container
    else
      pg_unread containers
    fi
    if pg_out=$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null); then
      ! mentions_pgadmin "$pg_out" || pg_hit image
    else
      pg_unread images
    fi
  else
    pg_unread docker
  fi

  if command -v dpkg-query >/dev/null 2>&1; then
    if pg_out=$(dpkg-query -W -f='${Package}\n' 2>/dev/null); then
      ! mentions_pgadmin "$pg_out" || pg_hit package
    else
      pg_unread packages
    fi
  fi
  if command -v pip3 >/dev/null 2>&1; then
    if pg_out=$(pip3 list 2>/dev/null); then
      ! mentions_pgadmin "$pg_out" || pg_hit python-package
    else
      pg_unread python-packages
    fi
  fi
  if command -v systemctl >/dev/null 2>&1; then
    if pg_out=$(systemctl list-units --all --no-legend --no-pager 2>/dev/null); then
      ! mentions_pgadmin "$pg_out" || pg_hit unit
    else
      pg_unread units
    fi
  fi
  if pg_out=$(ps -eo args 2>/dev/null); then
    ! mentions_pgadmin "$pg_out" || pg_hit process
  else
    pg_unread processes
  fi

  if [ "$LISTENER_OK" = 1 ]; then
    for pg_addr in $LISTEN_ADDRS; do
      for pg_port in $PGADMIN_PORTS; do
        case $pg_addr in
          *:"$pg_port") pg_hit port ;;
        esac
      done
    done
    ! mentions_pgadmin "$LISTENERS" || pg_hit port
  else
    pg_unread ports
  fi

  if [ -n "$PG_HITS" ]; then
    record pgadmin fail "found: $PG_HITS"
  elif [ -n "$PG_UNREAD" ]; then
    record pgadmin error "could not check: $PG_UNREAD"
  else
    record pgadmin pass 'no container, image, package, unit, process or listening port'
  fi
}

# --- check: bindings ----------------------------------------------------------------------------------

check_bindings() {
  if [ "$DOCKER_OK" != 1 ]; then
    record bindings error "$DOCKER_WHY"
    return 0
  fi
  cb_bad=''
  for cb_spec in $BIND_CHECKS; do
    cb_c=${cb_spec%%:*}
    cb_p=${cb_spec##*:}
    if ! cb_out=$(docker port "$cb_c" "$cb_p/tcp" 2>/dev/null) || [ -z "$cb_out" ]; then
      cb_bad="${cb_bad}${cb_bad:+; }$cb_c $cb_p not published"
      continue
    fi
    cb_class=loopback
    for cb_line in $cb_out; do
      class_of "$cb_line"
      case $CLASS in
        wildcard) cb_class=wildcard ;;
        other) [ "$cb_class" = wildcard ] || cb_class=other ;;
      esac
    done
    [ "$cb_class" = loopback ] || cb_bad="${cb_bad}${cb_bad:+; }$cb_c $cb_p $cb_class"
    if [ "$LISTENER_OK" = 1 ]; then
      cb_lclass=loopback
      for cb_addr in $LISTEN_ADDRS; do
        [ "${cb_addr##*:}" = "$cb_p" ] || continue
        class_of "$cb_addr"
        case $CLASS in
          wildcard) cb_lclass=wildcard ;;
          other) [ "$cb_lclass" = wildcard ] || cb_lclass=other ;;
        esac
      done
      [ "$cb_lclass" = loopback ] || cb_bad="${cb_bad}${cb_bad:+; }$cb_c $cb_p listener $cb_lclass"
    fi
  done
  if [ -n "$cb_bad" ]; then
    record bindings fail "$cb_bad"
  elif [ "$LISTENER_OK" = 1 ]; then
    record bindings pass 'redis_broker 6379 and socket_chat_server 3001 are published on loopback only'
  else
    record bindings pass 'redis_broker 6379 and socket_chat_server 3001 are published on loopback only (host listener table not readable)'
  fi
}

# --- the update summary (information) ------------------------------------------------------------------

UU_INSTALLED=unknown
UU_ENABLED=unknown
UU_ACTIVE=unknown
UU_LAST=unknown
PENDING=unknown
CONTAINER_INFO=''

collect_updates() {
  if command -v dpkg-query >/dev/null 2>&1; then
    UU_INSTALLED=no
    if cu_s=$(dpkg-query -W -f='${Status}' unattended-upgrades 2>/dev/null); then
      case $cu_s in
        *'install ok installed'*) UU_INSTALLED=yes ;;
      esac
    fi
  fi
  if command -v systemctl >/dev/null 2>&1; then
    cu_v=$(systemctl is-enabled unattended-upgrades 2>/dev/null) || :
    if [ -n "$cu_v" ]; then
      clean "$cu_v"
      UU_ENABLED=$CLEAN
    fi
    cu_v=$(systemctl is-active unattended-upgrades 2>/dev/null) || :
    if [ -n "$cu_v" ]; then
      clean "$cu_v"
      UU_ACTIVE=$CLEAN
    fi
  fi
  cu_v=$(stat -c %y /var/log/unattended-upgrades/unattended-upgrades.log 2>/dev/null) || :
  cu_day=${cu_v%% *}
  case $cu_day in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) UU_LAST=$cu_day ;;
  esac
  if command -v apt-get >/dev/null 2>&1; then
    if cu_out=$(apt-get -s dist-upgrade 2>/dev/null); then
      count_lines "$cu_out" 'Inst '
      PENDING=$COUNT
    fi
  fi
  [ "$DOCKER_OK" = 1 ] || return 0
  for cu_c in $EXPECTED; do
    has_line "$RUNNING" "$cu_c" || continue
    cu_rel=unknown
    cu_pk=unknown
    if cu_r=$(docker exec "$cu_c" cat /etc/alpine-release 2>/dev/null); then
      cu_rel=$cu_r
      case $cu_rel in
        '' | *[!0-9.]*) cu_rel=unknown ;;
      esac
    fi
    if cu_a=$(docker exec "$cu_c" apk info 2>/dev/null); then
      count_lines "$cu_a" ''
      cu_pk=$COUNT
    fi
    CONTAINER_INFO="${CONTAINER_INFO}${cu_c}|${cu_rel}|${cu_pk}${NL}"
  done
}

# --- output ---------------------------------------------------------------------------------------------------

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# a count stays a number, anything else becomes a string
json_value() {
  case "$1" in
    '' | *[!0-9]*) printf '"%s"' "$(json_escape "$1")" ;;
    *) printf '%s' "$1" ;;
  esac
}

emit_text() {
  echo 'check-vps-drift: read-only drift check of the chat VPS'
  while IFS='|' read -r et_id et_status et_detail; do
    [ -n "$et_id" ] || continue
    case "$et_status" in
      pass) et_tag=PASS ;;
      fail) et_tag=FAIL ;;
      *) et_tag=ERROR ;;
    esac
    echo "$et_tag $et_id: $et_detail"
  done <<EOF
$RESULTS
EOF
  et_info=''
  while IFS='|' read -r et_name et_rel et_pk; do
    [ -n "$et_name" ] || continue
    et_info="${et_info}${et_info:+, }$et_name alpine=$et_rel packages=$et_pk"
  done <<EOF
$CONTAINER_INFO
EOF
  echo "INFO updates: unattended-upgrades=$UU_ENABLED/$UU_ACTIVE installed=$UU_INSTALLED last_run=$UU_LAST pending=$PENDING | ${et_info:-no container information}"
  echo "RESULT: $RESULT"
}

emit_json() {
  printf '{"schema_version":"1.0","checked_at":"%s","result":"%s","checks":[' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RESULT"
  ej_first=1
  while IFS='|' read -r ej_id ej_status ej_detail; do
    [ -n "$ej_id" ] || continue
    [ "$ej_first" = 1 ] || printf ','
    ej_first=0
    printf '{"id":"%s","status":"%s","detail":"%s"}' "$ej_id" "$ej_status" "$(json_escape "$ej_detail")"
  done <<EOF
$RESULTS
EOF
  printf '],"updates":{"host":{"unattended_upgrades":{"installed":"%s","enabled":"%s","active":"%s","last_run":"%s"},"pending_upgrades":%s},"containers":[' \
    "$UU_INSTALLED" "$UU_ENABLED" "$UU_ACTIVE" "$UU_LAST" "$(json_value "$PENDING")"
  ej_first=1
  while IFS='|' read -r ej_name ej_rel ej_pk; do
    [ -n "$ej_name" ] || continue
    [ "$ej_first" = 1 ] || printf ','
    ej_first=0
    printf '{"name":"%s","alpine":"%s","packages":%s}' "$ej_name" "$ej_rel" "$(json_value "$ej_pk")"
  done <<EOF
$CONTAINER_INFO
EOF
  printf ']}}\n'
}

# --- run --------------------------------------------------------------------------------------------------------

check_containers
check_node
check_pgadmin
check_bindings
collect_updates

if [ "$FAILS" -gt 0 ]; then
  RESULT=fail
  CODE=1
elif [ "$ERRORS" -gt 0 ]; then
  RESULT=error
  CODE=2
else
  RESULT=pass
  CODE=0
fi

if [ "$FORMAT" = json ]; then
  emit_json
else
  emit_text
fi
exit "$CODE"
