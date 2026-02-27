const { sequelize, Flavor, Sale } = require('../models');
const { Op } = require('sequelize');

class DashboardController {
  static async getStats(req, res) {
    try {
      const t = await sequelize.transaction();
      
      try {
        // Get today's date in Colombia timezone (UTC-5)
        const todayColombia = new Date().toLocaleDateString('en-CA', { 
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }); // Format: YYYY-MM-DD
        
        console.log('🔍 Dashboard - Fecha Colombia (YYYY-MM-DD):', todayColombia);
        
        // 1. Total de sabores activos
        const [flavorResults] = await sequelize.query(`
          SELECT COUNT(*) as total_sabores
          FROM naxos.flavor f
          WHERE EXISTS (
            SELECT 1 FROM naxos.product_flavor pf 
            WHERE pf.flavor_id = f.flavor_id AND pf.is_active = true
          )
        `, { transaction: t });

        // 2. Ventas de hoy (Colombia timezone)
        const [salesResults] = await sequelize.query(`
          SELECT 
            COUNT(*) as cantidad_ventas,
            COALESCE(SUM(total), 0) as total_ventas
          FROM naxos.sale
          WHERE DATE(CONVERT_TZ(opened_at, '+00:00', '-05:00')) = :todayDate
            AND status = 'PAID'
        `, { 
          transaction: t,
          replacements: { todayDate }
        });

        // 3. Producto más vendido hoy (Colombia timezone)
        const [topProductResults] = await sequelize.query(`
          SELECT 
            p.name as product_name,
            COUNT(si.sale_item_id) as total_vendido,
            SUM(CAST(si.quantity AS INTEGER)) as total_unidades
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
          JOIN naxos.product p ON pv.product_id = p.product_id
          WHERE DATE(CONVERT_TZ(s.opened_at, '+00:00', '-05:00')) = :todayDate
            AND s.status = 'PAID'
          GROUP BY p.product_id, p.name
          ORDER BY total_unidades DESC
          LIMIT 1
        `, { 
          transaction: t,
          replacements: { todayDate }
        });

        // 4. Variante más vendida hoy (Colombia timezone)
        const [topVariantResults] = await sequelize.query(`
          SELECT 
            pv.variant_name,
            p.name as product_name,
            COUNT(si.sale_item_id) as total_vendido,
            SUM(CAST(si.quantity AS INTEGER)) as total_unidades
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
          JOIN naxos.product p ON pv.product_id = p.product_id
          WHERE DATE(CONVERT_TZ(s.opened_at, '+00:00', '-05:00')) = :todayDate
            AND s.status = 'PAID'
          GROUP BY pv.variant_id, pv.variant_name, p.name
          ORDER BY total_unidades DESC
          LIMIT 1
        `, { 
          transaction: t,
          replacements: { todayDate }
        });

        // 5. Sabor más vendido hoy (Colombia timezone)
        const [topFlavorResults] = await sequelize.query(`
          SELECT 
            f.name as flavor_name,
            COUNT(si.sale_item_id) as total_vendido,
            SUM(CAST(si.quantity AS INTEGER)) as total_unidades
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.flavor f ON si.flavor_id = f.flavor_id
          WHERE DATE(CONVERT_TZ(s.opened_at, '+00:00', '-05:00')) = :todayDate
            AND s.status = 'PAID'
            AND si.flavor_id IS NOT NULL
          GROUP BY f.flavor_id, f.name
          ORDER BY total_unidades DESC
          LIMIT 1
        `, { 
          transaction: t,
          replacements: { todayDate }
        });

        await t.commit();

        const stats = {
          totalSabores: parseInt(flavorResults[0].total_sabores),
          ventasHoy: {
            cantidad: parseInt(salesResults[0].cantidad_ventas),
            total: parseFloat(salesResults[0].total_ventas)
          },
          topProducto: topProductResults[0] || null,
          topVariante: topVariantResults[0] || null,
          topSabor: topFlavorResults[0] || null
        };

        console.log('🔍 Dashboard Stats Resultados:', {
          fecha: todayColombia,
          totalSabores: stats.totalSabores,
          ventasHoy: stats.ventasHoy,
          topProducto: stats.topProducto,
          topVariante: stats.topVariante,
          topSabor: stats.topSabor
        });

        return res.status(200).json({
          message: 'Estadísticas obtenidas exitosamente',
          data: stats
        });

      } catch (error) {
        await t.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error en dashboardController.getStats:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las estadísticas',
        details: error.message
      });
    }
  }
}

module.exports = DashboardController;
