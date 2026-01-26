#!/bin/sh
set -e

# Database file location from DATABASE_URL or default
DB_FILE="${DATABASE_URL:-file:/app/prisma/dev.db}"
# Extract just the path (remove 'file:' prefix)
DB_PATH="${DB_FILE#file:}"

echo "Starting Smart Notification Router..."
echo "Database path: $DB_PATH"

# If database doesn't exist, copy the template
if [ ! -f "$DB_PATH" ]; then
    echo "Database not found. Creating from template..."
    cp /app/prisma/template.db "$DB_PATH"
    echo "Database created successfully."
else
    echo "Existing database found."
fi

# Start the application
echo "Starting Next.js server..."
exec node server.js
