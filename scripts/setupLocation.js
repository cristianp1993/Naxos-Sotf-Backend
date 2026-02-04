const { sequelize } = require('../src/config/database-sequelize');

/**
 * Script para crear la location por defecto si no existe
 */

async function setupDefaultLocation() {
  try {
    console.log('🔍 Verificando location por defecto...');
    
    // Verificar si ya existe una location con ID=1
    const [existingLocation] = await sequelize.query(
      'SELECT location_id, name, is_active FROM naxos.inventory_location WHERE location_id = 1',
      { type: sequelize.QueryTypes.SELECT }
    );

    if (existingLocation) {
      console.log('✅ Location por defecto ya existe:', existingLocation);
      return;
    }

    // Crear location por defecto
    console.log('📍 Creando location por defecto...');
    const [newLocation] = await sequelize.query(`
      INSERT INTO naxos.inventory_location (location_id, name, address, is_active, created_at, updated_at)
      VALUES (1, 'NAXOS Principal', 'Dirección Principal', true, NOW(), NOW())
      RETURNING location_id, name, is_active, created_at
    `, { type: sequelize.QueryTypes.INSERT });

    console.log('✅ Location por defecto creada exitosamente!');
    console.log('📊 Datos de la location creada:', newLocation[0]);

  } catch (error) {
    console.error('❌ Error configurando location:', error.message);
    console.error('Detalles del error:', error);
    process.exit(1);
  } finally {
    // Cerrar conexión
    await sequelize.close();
    console.log('🔌 Conexión a la base de datos cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  setupDefaultLocation()
    .then(() => {
      console.log('🎉 Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = setupDefaultLocation;
