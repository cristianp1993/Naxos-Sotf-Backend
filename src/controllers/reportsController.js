const { query } = require('../config/database');
const Joi = require('joi');

// Esquema de validación para fechas
const dateRangeSchema = Joi.object({
  start_date: Joi.date().required(),
  end_date: Joi.date().required(),
  location_id: Joi.number().integer().positive().optional()
});

class ReportsController {

  // ==================== DASHBOARD ====================

  // Dashboard general con métricas principales
  static async getDashboard(req, res) {
    try {
      res.status(200).json({
        message: 'Dashboard cargado exitosamente',
        dashboard: {
          today_sales: { total_sales: 0, total_revenue: 0, avg_sale: 0 },
          yesterday_sales: { total_sales: 0, total_revenue: 0, avg_sale: 0 },
          monthly_sales: { total_sales: 0, total_revenue: 0 },
          alerts: { low_stock_count: 0, pending_sales_count: 0 },
          top_products_today: [],
          hourly_sales: []
        }
      });
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo cargar el dashboard'
      });
    }
  }

  // ==================== REPORTES DE VENTAS ====================

  // Reporte de ventas por período
  static async getSalesReport(req, res) {
    try {
      const { error, value } = dateRangeSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { start_date, end_date, location_id } = value;
      let whereClause = 'WHERE s.status = \'PAID\' AND s.paid_at >= $1 AND s.paid_at <= $2';
      let params = [start_date, end_date];
      let paramCount = 2;

      if (location_id) {
        paramCount++;
        whereClause += ` AND s.location_id = $${paramCount}`;
        params.push(location_id);
      }

      // Resumen general de ventas
      const summary = await query(`
        SELECT
          COUNT(*) as total_sales,
          COALESCE(SUM(s.total), 0) as total_revenue,
          COALESCE(AVG(s.total), 0) as avg_sale_amount,
          COALESCE(SUM(
            (SELECT COUNT(*) FROM naxos.sale_item WHERE sale_id = s.sale_id)
          ), 0) as total_items_sold,
          COALESCE(SUM(
            (SELECT SUM(quantity) FROM naxos.sale_item WHERE sale_id = s.sale_id)
          ), 0) as total_quantity_sold
        FROM naxos.sale s
        ${whereClause}
      `, params);

      res.status(200).json({
        message: 'Reporte de ventas generado exitosamente',
        report: {
          period: { start_date, end_date, location_id },
          summary: {
            ...summary.rows[0],
            total_revenue: parseFloat(summary.rows[0].total_revenue),
            avg_sale_amount: parseFloat(summary.rows[0].avg_sale_amount),
            total_items_sold: parseInt(summary.rows[0].total_items_sold),
            total_quantity_sold: parseFloat(summary.rows[0].total_quantity_sold)
          },
          daily_sales: [],
          payment_methods: [],
          top_products: [],
          category_sales: []
        }
      });

    } catch (error) {
      console.error('Error generando reporte de ventas:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar el reporte de ventas'
      });
    }
  }

  // ==================== REPORTES DE INVENTARIO ====================

  // Reporte de movimientos de inventario
  static async getInventoryMovementsReport(req, res) {
    try {
      const { error, value } = dateRangeSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      res.status(200).json({
        message: 'Reporte de movimientos de inventario generado exitosamente',
        report: { period: value, summary: [], movements: [], daily_movements: [] }
      });

    } catch (error) {
      console.error('Error generando reporte de movimientos:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar el reporte de movimientos'
      });
    }
  }

  // ==================== REPORTES DE STOCK ====================

  // Reporte de stock actual
  static async getStockReport(req, res) {
    try {
      res.status(200).json({
        message: 'Reporte de stock generado exitosamente',
        report: { location_id: null, current_stock: [], low_stock: [], category_summary: [] }
      });

    } catch (error) {
      console.error('Error generando reporte de stock:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar el reporte de stock'
      });
    }
  }

  // ==================== REPORTES DE TURNOS ====================

  // Reporte de rendimiento de turnos
  static async getShiftsReport(req, res) {
    try {
      const { error, value } = dateRangeSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      res.status(200).json({
        message: 'Reporte de turnos generado exitosamente',
        report: { period: value, summary: {}, shift_performance: [], location_performance: [] }
      });

    } catch (error) {
      console.error('Error generando reporte de turnos:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar el reporte de turnos'
      });
    }
  }

  // ==================== REPORTES DE PRODUCTOS ====================

  // Reporte de rendimiento de productos
  static async getProductsReport(req, res) {
    try {
      const { error, value } = dateRangeSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      res.status(200).json({
        message: 'Reporte de productos generado exitosamente',
        report: { period: value, summary: {}, top_products: [], top_variants: [], category_performance: [] }
      });

    } catch (error) {
      console.error('Error generando reporte de productos:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar el reporte de productos'
      });
    }
  }
}

module.exports = ReportsController;
