const { sequelize } = require('../src/config/database-sequelize');

/**
 * Script de migracion para crear las tablas de inventario
 * Tablas: inventory_location, inventory_stock, inventory_movement
 * Trigger: actualiza inventory_stock al insertar un movimiento
 */
async function migrateInventory() {
  try {
    console.log('Iniciando migracion de tablas de inventario...');

    // 1. Crear tabla inventory_location
    console.log('Creando tabla inventory_location...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS naxos.inventory_location (
        location_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        address VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Tabla inventory_location creada/verificada');

    // 2. Crear tabla inventory_stock
    console.log('Creando tabla inventory_stock...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS naxos.inventory_stock (
        location_id INTEGER NOT NULL REFERENCES naxos.inventory_location(location_id),
        variant_id INTEGER NOT NULL REFERENCES naxos.product_variant(variant_id),
        qty_on_hand NUMERIC(15,3) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (location_id, variant_id)
      )
    `);
    console.log('Tabla inventory_stock creada/verificada');

    // 3. Crear tabla inventory_movement
    console.log('Creando tabla inventory_movement...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS naxos.inventory_movement (
        movement_id SERIAL PRIMARY KEY,
        location_id INTEGER NOT NULL REFERENCES naxos.inventory_location(location_id),
        variant_id INTEGER NOT NULL REFERENCES naxos.product_variant(variant_id),
        movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('PURCHASE', 'ADJUSTMENT', 'SALE', 'RETURN')),
        qty_change NUMERIC(15,3) NOT NULL,
        reason VARCHAR(500),
        ref_sale_id INTEGER,
        created_by INTEGER REFERENCES naxos.users(user_id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Tabla inventory_movement creada/verificada');

    // 4. Crear indice para busqueda por variant_id en movimientos
    console.log('Creando indices...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_movement_variant ON naxos.inventory_movement(variant_id)
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_movement_location ON naxos.inventory_movement(location_id)
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_movement_sale ON naxos.inventory_movement(ref_sale_id)
    `);
    console.log('Indices creados/verificados');

    // 5. Crear funcion y trigger para actualizar stock automaticamente
    console.log('Creando funcion update_inventory_stock...');
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION naxos.update_inventory_stock()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO naxos.inventory_stock (location_id, variant_id, qty_on_hand, updated_at)
        VALUES (NEW.location_id, NEW.variant_id, NEW.qty_change, NOW())
        ON CONFLICT (location_id, variant_id)
        DO UPDATE SET
          qty_on_hand = naxos.inventory_stock.qty_on_hand + EXCLUDED.qty_on_hand,
          updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('Funcion update_inventory_stock creada/verificada');

    console.log('Creando trigger trg_update_inventory_stock...');
    await sequelize.query(`
      DROP TRIGGER IF EXISTS trg_update_inventory_stock ON naxos.inventory_movement;
      CREATE TRIGGER trg_update_inventory_stock
      AFTER INSERT ON naxos.inventory_movement
      FOR EACH ROW
      EXECUTE FUNCTION naxos.update_inventory_stock()
    `);
    console.log('Trigger trg_update_inventory_stock creado/verificado');

    // 6. Crear location por defecto si no existe
    console.log('Verificando location por defecto...');
    const [existingLocation] = await sequelize.query(
      'SELECT location_id FROM naxos.inventory_location WHERE location_id = 1',
      { type: sequelize.QueryTypes.SELECT }
    );

    if (!existingLocation) {
      console.log('Creando location por defecto...');
      await sequelize.query(`
        INSERT INTO naxos.inventory_location (location_id, name, address, is_active, created_at, updated_at)
        VALUES (1, 'NAXOS Principal', 'Direccion Principal', true, NOW(), NOW())
      `);
      console.log('Location por defecto creada');
    } else {
      console.log('Location por defecto ya existe');
    }

    console.log('Migracion completada exitosamente');

  } catch (error) {
    console.error('Error en migracion:', error.message);
    // No abortar: el servidor puede funcionar sin inventario
  } finally {
    await sequelize.close();
    console.log('Conexion cerrada');
  }
}

if (require.main === module) {
  migrateInventory()
    .then(() => {
      console.log('Script de migracion completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error fatal en migracion:', error);
      // No abortar con error para que el entrypoint continue
      process.exit(0);
    });
}

module.exports = migrateInventory;
