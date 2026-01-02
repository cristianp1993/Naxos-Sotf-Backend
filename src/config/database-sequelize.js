const { Sequelize } = require('sequelize');
require('dotenv').config();

/**
 * ENV esperadas:
 * - NODE_ENV=development|production
 * - DB_HOST
 * - DB_PORT
 * - DB_NAME
 * - DB_USER
 * - DB_PASSWORD
 * - DB_SCHEMA (ej: 'naxos')
 * - DB_SYNC ('true' en local si quieres sync, 'false' en producción)
 */

const isProduction = process.env.NODE_ENV === 'production';
const shouldSync = (process.env.DB_SYNC || '').toLowerCase() === 'true';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || (isProduction ? 'postgres' : 'naxos_pos');
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_SCHEMA = process.env.DB_SCHEMA || 'public';

// Configuración de Sequelize
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false,

  // ✅ SSL SOLO en producción (Supabase)
  ...(isProduction
    ? {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
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

// Probar conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión Sequelize establecida con PostgreSQL');
    console.log(
      `ℹ️ DB: ${DB_NAME} | Host: ${DB_HOST}:${DB_PORT} | Schema: ${DB_SCHEMA} | SSL: ${isProduction ? 'ON' : 'OFF'}`
    );
    return true;
  } catch (error) {
    console.error('❌ Error conectando con Sequelize:', error);
    return false;
  }
};

// Sincronizar modelos (solo si DB_SYNC=true)
const syncModels = async () => {
  try {
    if (!shouldSync) {
      console.log('ℹ️ DB_SYNC=false → no se ejecuta sequelize.sync()');
      return true;
    }

    console.log('🔄 DB_SYNC=true → ejecutando sequelize.sync({ alter: true })...');
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error sincronizando modelos:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncModels,
};
