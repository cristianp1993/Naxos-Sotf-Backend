// Script para probar si el problema de line_total está resuelto
const { sequelize, Sale, SaleItem, SalePayment, Variant } = require('./src/models');

async function testLineTotal() {
  try {
    console.log('🧪 Probando inserción de SaleItem sin line_total...');
    
    // Intentar crear un SaleItem sin line_total
    const testItem = await SaleItem.create({
      sale_id: 1, // Asumimos que existe una venta con ID 1
      variant_id: 1, // Asumimos que existe un variant con ID 1
      flavor_id: null,
      quantity: 1,
      unit_price: 10.00
      // Sin line_total - debería ser calculado por la BD
    });
    
    console.log('✅ Test exitoso:', testItem.toJSON());
    
  } catch (error) {
    console.error('❌ Error en test:', error.message);
    console.error('Detalles:', error);
  } finally {
    await sequelize.close();
  }
}

testLineTotal();
