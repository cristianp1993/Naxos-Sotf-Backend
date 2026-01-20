const { Sequelize } = require("sequelize");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";
const shouldSync = (process.env.DB_SYNC || "").toLowerCase() === "true";

/**
 * Decide si usar SSL:
 * - Si DB_SSL=true => fuerza SSL
 * - Si DB_SSL=false => fuerza NO SSL
 * - Si no está definido:
 *    - Si en DATABASE_URL viene sslmode=disable => NO SSL
 *    - Si viene ssl=true o sslmode=require/verify-* => SSL
 *    - Si no viene nada => por defecto NO SSL (ideal para Postgres interno sin SSL)
 */
function resolveSSLFromEnvAndUrl(databaseUrl) {
  const env = (process.env.DB_SSL || "").toLowerCase();
  if (env === "true" || env === "1" || env === "yes") return true;
  if (env === "false" || env === "0" || env === "no") return false;

  if (!databaseUrl) return false;

  try {
    const url = new URL(databaseUrl);
    const sslmode = (url.searchParams.get("sslmode") || "").toLowerCase();
    const ssl = (url.searchParams.get("ssl") || "").toLowerCase();

    if (ssl === "false" || ssl === "0") return false;
    if (ssl === "true" || ssl === "1") return true;

    // sslmode (estilo libpq)
    if (sslmode === "disable") return false;
    if (["require", "verify-ca", "verify-full"].includes(sslmode)) return true;

    return false;
  } catch {
    return false;
  }
}

const useSSL = resolveSSLFromEnvAndUrl(process.env.DATABASE_URL);

let sequelize;

if (process.env.DATABASE_URL) {
  console.log("ℹ️ Usando DATABASE_URL para conexión a base de datos");

  const url = new URL(process.env.DATABASE_URL);
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const hostname = url.hostname;
  const port = parseInt(url.port, 10) || 5432;
  const database = url.pathname.substring(1);

  sequelize = new Sequelize(database, username, password, {
    host: hostname,
    port,
    dialect: "postgres",
    dialectOptions: {
      // ✅ SSL solo si corresponde
      ...(useSSL
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : { ssl: false }),

      // Fuerza IPv4 explícitamente en el cliente pg
      connection: {
        family: 4,
      },
    },
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      schema: process.env.DB_SCHEMA || "public",
    },
  });

  console.log(`ℹ️ SSL para DB: ${useSSL ? "ACTIVADO" : "DESACTIVADO"}`);
} else {
  // 🧪 Modo desarrollo con variables separadas
  const DB_HOST = process.env.DB_HOST || "localhost";
  const DB_PORT = parseInt(process.env.DB_PORT || "5432", 10);
  const DB_NAME = process.env.DB_NAME || "naxos_pos";
  const DB_USER = process.env.DB_USER || "postgres";
  const DB_PASSWORD = process.env.DB_PASSWORD || "";
  const DB_SCHEMA = process.env.DB_SCHEMA || "public";

  console.log(`ℹ️ Usando ${DB_NAME} como DB`);

  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: "postgres",
    logging: false,
    ...(isProduction
      ? {
          dialectOptions: {
            ...(useSSL
              ? {
                  ssl: {
                    require: true,
                    rejectUnauthorized: false,
                  },
                }
              : { ssl: false }),
          },
        }
      : {}),
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      schema: DB_SCHEMA,
    },
  });

  console.log(`ℹ️ SSL para DB: ${useSSL ? "ACTIVADO" : "DESACTIVADO"}`);
}

// Probar conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexión Sequelize establecida con PostgreSQL");
    return true;
  } catch (error) {
    console.error("❌ Error conectando con Sequelize:", error);
    return false;
  }
};

// Sincronizar modelos
const syncModels = async () => {
  try {
    if (!shouldSync) {
      console.log("ℹ️ DB_SYNC=false → no se ejecuta sequelize.sync()");
      return true;
    }
    console.log("🔄 DB_SYNC=true → ejecutando sequelize.sync({ alter: true })...");
    await sequelize.sync({ alter: true });
    console.log("✅ Modelos sincronizados correctamente");
    return true;
  } catch (error) {
    console.error("❌ Error sincronizando modelos:", error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncModels,
};
