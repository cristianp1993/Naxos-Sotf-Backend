const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuración de logging: false en producción, solo errores en desarrollo
const isDevelopment = process.env.NODE_ENV !== 'production';
const logging = isDevelopment ? false : false; // Desactivado para menos ruido en consola

// Configuración de Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME || 'naxos_pos',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: logging,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      schema: 'naxos', // Esquema de la base de datos
    },
    schema: 'naxos', // Esquema global
  }
);

// Función para probar la conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión Sequelize establecida con PostgreSQL');
    return true;
  } catch (error) {
    console.error('❌ Error conectando con Sequelize:', error.message);
    return false;
  }
};

// Función para sincronizar modelos
const syncModels = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error sincronizando modelos:', error.message);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncModels
};
