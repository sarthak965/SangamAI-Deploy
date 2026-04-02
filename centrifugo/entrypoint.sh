#!/bin/sh
set -eu

if [ -z "${CENTRIFUGO_API_KEY:-}" ]; then
  echo "CENTRIFUGO_API_KEY is required"
  exit 1
fi

if [ -z "${CENTRIFUGO_TOKEN_SECRET:-}" ]; then
  echo "CENTRIFUGO_TOKEN_SECRET is required"
  exit 1
fi

ALLOWED_ORIGINS="${CENTRIFUGO_ALLOWED_ORIGINS:-http://localhost:5173}"
ORIGINS_JSON=$(
  printf '%s' "$ALLOWED_ORIGINS" | awk -v RS=',' '
    BEGIN { first = 1; printf "[" }
    {
      gsub(/^[ \t\r\n]+|[ \t\r\n]+$/, "", $0)
      if (length($0) > 0) {
        if (!first) printf ", "
        gsub(/"/, "\\\"", $0)
        printf "\"" $0 "\""
        first = 0
      }
    }
    END { printf "]" }
  '
)

cat > /tmp/config.json <<EOF
{
  "token_hmac_secret_key": "${CENTRIFUGO_TOKEN_SECRET}",
  "api_key": "${CENTRIFUGO_API_KEY}",
  "allowed_origins": ${ORIGINS_JSON},
  "health": true
}
EOF

exec centrifugo --config=/tmp/config.json --http_server.port="${PORT:-8000}"
