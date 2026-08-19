#!/bin/sh
# Entrypoint del backend: ejecuta migraciones y luego arranca el servidor

echo "Ejecutando migraciones de inventario..."
node scripts/migrateInventory.js

echo "Iniciando servidor..."
exec node src/index.js
