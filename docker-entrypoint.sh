#!/bin/sh
set -e

# Database file location from DATABASE_URL or default
DB_FILE="${DATABASE_URL:-file:/app/prisma/dev.db}"
# Extract just the path (remove 'file:' prefix)
DB_PATH="${DB_FILE#file:}"

echo "Starting SNR - Smart Notification Router..."
echo "Database path: $DB_PATH"

# Ensure prisma directory exists (it may be an empty volume mount)
mkdir -p /app/prisma

# If database doesn't exist, copy the template
# Template is stored at /app/template.db (not in /app/prisma which gets overwritten by volume)
if [ ! -f "$DB_PATH" ]; then
    echo "Database not found. Creating from template..."
    cp /app/template.db "$DB_PATH"
    echo "Database created successfully."
else
    echo "Existing database found."
fi

# Run schema migrations to ensure database is up to date
echo "Running schema migration..."
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 || echo "Warning: Schema migration failed, continuing anyway..."

# Start the application
echo "Starting Next.js server..."
exec node server.js
