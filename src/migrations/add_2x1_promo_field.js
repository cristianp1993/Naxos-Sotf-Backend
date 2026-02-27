// Migration para agregar campo de promoción 2x1 a sale_item
const { sequelize } = require('../config/database-sequelize');

async function add2x1PromoField() {
  try {
    // Agregar campo is_promo_2x1 a la tabla sale_item
    await sequelize.query(`
      ALTER TABLE naxos.sale_item 
      ADD COLUMN IF NOT EXISTS is_promo_2x1 BOOLEAN DEFAULT FALSE;
    `);

    // Agregar campo promo_reference para identificar items relacionados
    await sequelize.query(`
      ALTER TABLE naxos.sale_item 
      ADD COLUMN IF NOT EXISTS promo_reference VARCHAR(50) NULL;
    `);

    console.log('✅ Campos de promoción 2x1 agregados exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error agregando campos de promoción:', error);
    return false;
  }
}

module.exports = { add2x1PromoField };
