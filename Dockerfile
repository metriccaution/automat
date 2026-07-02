FROM oven/bun:1-alpine

WORKDIR /app

# Install runtime deps (no devDependencies needed — bun runs TS directly)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy application source and meal definitions
COPY index.ts tsconfig.json ./
COPY lib/ ./lib/
COPY meals/ ./meals/

# Cron job: run planner every day at 03:00
# Output is redirected to PID-1's stdout so it appears in `docker logs`
RUN printf '0 3 * * *\tcd /app && bun run index.ts >> /proc/1/fd/1 2>&1\n' \
    > /etc/crontabs/root

# /data is the mount point for the SQLite history DB
# config.json must be bind-mounted at /app/config.json at runtime (never bake secrets into image)
VOLUME ["/data"]

# crond -f: run in foreground (keeps container alive); -d 8: log to stderr at minimum verbosity
CMD ["crond", "-f", "-d", "8"]
