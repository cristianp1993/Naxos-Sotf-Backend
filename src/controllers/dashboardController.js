const { sequelize, Flavor, Sale, SaleItem, ProductVariant, Product } = require('../models');
const { Op } = require('sequelize');

class DashboardController {
  static async getStats(req, res) {
    try {
      console.log('🔍 Dashboard: Iniciando获取 de estadísticas');
      
      // Get today's date in Colombia timezone (UTC-5)
      const now = new Date();
      const todayColombia = new Date(now.getTime() - (5 * 60 * 60 * 1000)); // Restar 5 horas para UTC-5
      const todayDateString = todayColombia.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      console.log('🔍 Dashboard - Fecha actual UTC:', now.toISOString());
      console.log('🔍 Dashboard - Fecha Colombia (YYYY-MM-DD):', todayDateString);
      
      // 1. Total de sabores activos
      let totalSabores = 0;
      try {
        const [flavorResults] = await sequelize.query(`
          SELECT COUNT(*) as total_sabores
          FROM naxos.flavor f
          WHERE EXISTS (
            SELECT 1 FROM naxos.product_flavor pf 
            WHERE pf.flavor_id = f.flavor_id AND pf.is_active = true
          )
        `);
        totalSabores = parseInt(flavorResults[0]?.total_sabores || 0);
        console.log('🔍 Dashboard - Total sabores:', totalSabores);
      } catch (error) {
        console.error('🔍 Dashboard - Error obteniendo sabores:', error);
        totalSabores = 0;
      }

      // 2. Ventas de hoy (Colombia timezone)
      let ventasHoy = { cantidad: 0, total: 0 };
      try {
        const [salesResults] = await sequelize.query(`
          SELECT 
            COUNT(*) as cantidad_ventas,
            COALESCE(SUM(total), 0) as total_ventas
          FROM naxos.sale
          WHERE DATE(opened_at AT TIME ZONE 'America/Bogota') = :todayDate
            AND status = 'PAID'
        `, { 
          replacements: { todayDate: todayDateString }
        });
        
        ventasHoy = {
          cantidad: parseInt(salesResults[0]?.cantidad_ventas || 0),
          total: parseFloat(salesResults[0]?.total_ventas || 0)
        };
        console.log('🔍 Dashboard - Ventas hoy:', ventasHoy);
      } catch (error) {
        console.error('🔍 Dashboard - Error obteniendo ventas hoy:', error);
        ventasHoy = { cantidad: 0, total: 0 };
      }

      // 3. Producto más vendido hoy (Colombia timezone)
      let topProducto = null;
      try {
        const [topProductResults] = await sequelize.query(`
          SELECT 
            p.name as product_name,
            COUNT(si.sale_item_id) as total_vendido,
            SUM(CAST(si.quantity AS INTEGER)) as total_unidades
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
          JOIN naxos.product p ON pv.product_id = p.product_id
          WHERE DATE(s.opened_at AT TIME ZONE 'America/Bogota') = :todayDate
            AND s.status = 'PAID'
          GROUP BY p.product_id, p.name
          ORDER BY total_unidades DESC
          LIMIT 1
        `, { 
          replacements: { todayDate: todayDateString }
        });
        
        if (topProductResults && topProductResults.length > 0) {
          topProducto = {
            product_name: topProductResults[0].product_name,
            total_vendido: parseInt(topProductResults[0].total_vendido),
            total_unidades: parseInt(topProductResults[0].total_unidades)
          };
        }
        console.log('🔍 Dashboard - Top producto:', topProducto);
      } catch (error) {
        console.error('🔍 Dashboard - Error obteniendo top producto:', error);
        topProducto = null;
      }

      // 4. Variante más vendida hoy (Colombia timezone)
      let topVariante = null;
      try {
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
          WHERE DATE(s.opened_at AT TIME ZONE 'America/Bogota') = :todayDate
            AND s.status = 'PAID'
          GROUP BY pv.variant_id, pv.variant_name, p.name
          ORDER BY total_unidades DESC
          LIMIT 1
        `, { 
          replacements: { todayDate: todayDateString }
        });
        
        if (topVariantResults && topVariantResults.length > 0) {
          topVariante = {
            variant_name: topVariantResults[0].variant_name,
            product_name: topVariantResults[0].product_name,
            total_vendido: parseInt(topVariantResults[0].total_vendido),
            total_unidades: parseInt(topVariantResults[0].total_unidades)
          };
        }
        console.log('🔍 Dashboard - Top variante:', topVariante);
      } catch (error) {
        console.error('🔍 Dashboard - Error obteniendo top variante:', error);
        topVariante = null;
      }

      // 5. Sabor más vendido hoy (Colombia timezone)
      let topSabor = null;
      try {
        const [topFlavorResults] = await sequelize.query(`
          SELECT 
            f.name as flavor_name,
            COUNT(si.sale_item_id) as total_vendido,
            SUM(CAST(si.quantity AS INTEGER)) as total_unidades
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.flavor f ON si.flavor_id = f.flavor_id
          WHERE DATE(s.opened_at AT TIME ZONE 'America/Bogota') = :todayDate
            AND s.status = 'PAID'
            AND si.flavor_id IS NOT NULL
          GROUP BY f.flavor_id, f.name
          ORDER BY total_unidades DESC
          LIMIT 1
        `, { 
          replacements: { todayDate: todayDateString }
        });
        
        if (topFlavorResults && topFlavorResults.length > 0) {
          topSabor = {
            flavor_name: topFlavorResults[0].flavor_name,
            total_vendido: parseInt(topFlavorResults[0].total_vendido),
            total_unidades: parseInt(topFlavorResults[0].total_unidades)
          };
        }
        console.log('🔍 Dashboard - Top sabor:', topSabor);
      } catch (error) {
        console.error('🔍 Dashboard - Error obteniendo top sabor:', error);
        topSabor = null;
      }

      const stats = {
        totalSabores,
        ventasHoy,
        topProducto,
        topVariante,
        topSabor
      };

      console.log('🔍 Dashboard Stats Resultados:', {
        fecha: todayDateString,
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
      console.error('❌ Error en dashboardController.getStats:', error);
      console.error('❌ Stack trace:', error.stack);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las estadísticas',
        details: error.message
      });
    }
  }
}

module.exports = DashboardController;
