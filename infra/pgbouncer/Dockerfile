# PgBouncer (transaction-pooling, per-role pass-through auth) for the
# trading-alerts Postgres instance. See pgbouncer.ini and entrypoint.sh for
# the auth design — Session 1-3b (docs/migration-orders/1-3b-pgbouncer.migration-order.md).
FROM alpine:3.20

RUN apk add --no-cache pgbouncer \
    && addgroup -S pgbouncer \
    && adduser -S -D -H -G pgbouncer pgbouncer

COPY pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown -R pgbouncer:pgbouncer /etc/pgbouncer

USER pgbouncer
EXPOSE 6432

ENTRYPOINT ["/entrypoint.sh"]
