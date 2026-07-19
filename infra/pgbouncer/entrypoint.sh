#!/bin/sh
set -eu

if [ -z "${PGBOUNCER_USERLIST_B64:-}" ]; then
  echo "PGBOUNCER_USERLIST_B64 is required (base64-encoded userlist.txt with SCRAM verifiers, set as a Railway variable)" >&2
  exit 1
fi

echo "$PGBOUNCER_USERLIST_B64" | base64 -d > /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
