const { query, testConnection } = require('./database-sequelize');

// CP 2026-08-18 database.js ahora es una fachada que reutiliza
// la conexion unica de Sequelize definida en database-sequelize.js.
// Esto evita tener dos conexiones/pools duplicados a PostgreSQL.

module.exports = {
  query,
  testConnection,
  pool: null
};
