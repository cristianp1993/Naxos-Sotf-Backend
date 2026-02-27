const { sequelize, Sale, SaleItem, SalePayment, Expense, Variant, Product } = require('../models');
const { Op } = require('sequelize');
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

  // ==================== REPORTES DE FLUJO DE CAJA ====================

  // Reporte de flujo de caja completo
  static async getCashFlowReport(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({
          error: 'Parámetros requeridos',
          message: 'Se requieren start_date y end_date en formato YYYY-MM-DD'
        });
      }

      // Create date range in Colombia timezone
      const startDate = new Date(start_date + 'T00:00:00-05:00');
      const endDate = new Date(end_date + 'T23:59:59-05:00');
      
      console.log('🔍 Reporte - Rango fechas Colombia:', {
        start_date,
        end_date,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const t = await sequelize.transaction();

      try {
        // 1. Total ingresos por ventas con desglose por método de pago
        const [salesResults] = await sequelize.query(`
          SELECT 
            COUNT(DISTINCT s.sale_id) as total_ventas,
            COALESCE(SUM(s.total), 0) as total_ingresos,
            COALESCE(SUM(CASE WHEN sp.method = 'CASH' THEN sp.amount ELSE 0 END), 0) as total_efectivo,
            COALESCE(SUM(CASE WHEN sp.method = 'TRANSFER' THEN sp.amount ELSE 0 END), 0) as total_transferencia,
            COALESCE(SUM(CASE WHEN sp.method = 'CARD' THEN sp.amount ELSE 0 END), 0) as total_tarjeta,
            COALESCE(SUM(CASE WHEN sp.method = 'OTHER' THEN sp.amount ELSE 0 END), 0) as total_otro,
            COUNT(CASE WHEN sp.method = 'CASH' THEN 1 END) as ventas_efectivo,
            COUNT(CASE WHEN sp.method = 'TRANSFER' THEN 1 END) as ventas_transferencia,
            COUNT(CASE WHEN sp.method = 'CARD' THEN 1 END) as ventas_tarjeta,
            COUNT(CASE WHEN sp.method = 'OTHER' THEN 1 END) as ventas_otro
          FROM naxos.sale s
          JOIN naxos.sale_payment sp ON s.sale_id = sp.sale_id
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        // 2. Total gastos
        const [expenseResults] = await sequelize.query(`
          SELECT 
            COUNT(*) as total_gastos,
            COALESCE(SUM(e.amount), 0) as total_egresos
          FROM naxos.expense e
          WHERE e.expense_date BETWEEN :startDate AND :endDate
        `, {
          transaction: t,
          replacements: { 
            startDate: start_date, 
            endDate: end_date 
          }
        });

        // 3. Detalle de gastos
        const [expenseDetails] = await sequelize.query(`
          SELECT 
            e.id,
            e.expense_date,
            e.concept,
            e.description,
            e.amount
          FROM naxos.expense e
          WHERE e.expense_date BETWEEN :startDate AND :endDate
          ORDER BY e.expense_date DESC, e.amount DESC
        `, {
          transaction: t,
          replacements: { 
            startDate: start_date, 
            endDate: end_date 
          }
        });

        // 4. Ventas por tamaño (basado en nombres de variantes)
        const [salesBySize] = await sequelize.query(`
          SELECT 
            pv.variant_name as tamaño,
            COUNT(si.sale_item_id) as cantidad_vendida,
            COALESCE(SUM(si.quantity), 0) as total_unidades,
            COALESCE(SUM(si.line_total), 0) as total_ventas
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
          GROUP BY pv.variant_id, pv.variant_name
          ORDER BY total_ventas DESC
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        await t.commit();

        const salesData = salesResults[0];
        const expenseData = expenseResults[0];
        
        // Calcular diferencia y resultado
        const diferencia = salesData.total_ingresos - expenseData.total_egresos;
        const resultado = diferencia >= 0 ? 'POSITIVO' : 'NEGATIVO';

        const reportData = {
          periodo: {
            start_date,
            end_date,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          resumen: {
            total_ingresos: parseFloat(salesData.total_ingresos),
            total_egresos: parseFloat(expenseData.total_egresos),
            diferencia: parseFloat(diferencia),
            resultado
          },
          ventas: {
            total_ventas: parseInt(salesData.total_ventas),
            desglose_pagos: {
              efectivo: {
                cantidad: parseInt(salesData.ventas_efectivo),
                total: parseFloat(salesData.total_efectivo)
              },
              transferencia: {
                cantidad: parseInt(salesData.ventas_transferencia),
                total: parseFloat(salesData.total_transferencia)
              },
              tarjeta: {
                cantidad: parseInt(salesData.ventas_tarjeta),
                total: parseFloat(salesData.total_tarjeta)
              },
              otro: {
                cantidad: parseInt(salesData.ventas_otro),
                total: parseFloat(salesData.total_otro)
              }
            }
          },
          gastos: {
            total_gastos: parseInt(expenseData.total_gastos),
            detalle: expenseDetails.map(expense => ({
              id: expense.id,
              fecha: expense.expense_date,
              concepto: expense.concept,
              descripcion: expense.description,
              monto: parseFloat(expense.amount)
            }))
          },
          ventas_por_tamaño: salesBySize.map(size => ({
            tamaño: size.tamaño,
            cantidad_vendida: parseInt(size.cantidad_vendida),
            total_unidades: parseInt(size.total_unidades),
            total_ventas: parseFloat(size.total_ventas)
          }))
        };

        console.log('🔍 Reporte de flujo de caja generado:', {
          periodo: reportData.periodo,
          resumen: reportData.resumen,
          total_ventas: reportData.ventas.total_ventas,
          total_gastos: reportData.gastos.total_gastos,
          tamaños: reportData.ventas_por_tamaño.length
        });

        return res.status(200).json({
          message: 'Reporte de flujo de caja generado exitosamente',
          data: reportData
        });

      } catch (error) {
        await t.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error en ReportsController.getCashFlowReport:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar el reporte de flujo de caja',
        details: error.message
      });
    }
  }

  // Descarga de reporte en PDF/Excel
  static async downloadCashFlowReport(req, res) {
    try {
      const { start_date, end_date, format } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({
          error: 'Parámetros requeridos',
          message: 'Se requieren start_date y end_date'
        });
      }

      if (!format || !['pdf', 'excel'].includes(format)) {
        return res.status(400).json({
          error: 'Formato inválido',
          message: 'El formato debe ser pdf o excel'
        });
      }

      // Por ahora, devolvemos el mismo JSON que el reporte normal
      // En una implementación completa, aquí generaríamos el archivo PDF/Excel
      const reportResponse = await this.getCashFlowReport({
        query: { start_date, end_date }
      }, {
        status: (code) => ({
          json: (data) => data
        })
      });

      const reportData = reportResponse.data;

      if (format === 'pdf') {
        // TODO: Implementar generación de PDF
        return res.status(200).json({
          message: 'Descarga PDF no implementada aún',
          data: reportData
        });
      } else if (format === 'excel') {
        // TODO: Implementar generación de Excel
        return res.status(200).json({
          message: 'Descarga Excel no implementada aún',
          data: reportData
        });
      }

    } catch (error) {
      console.error('Error en ReportsController.downloadCashFlowReport:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar la descarga del reporte',
        details: error.message
      });
    }
  }

  static async getSalesSummary(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({
          error: 'Parámetros requeridos',
          message: 'Se requieren start_date y end_date en formato YYYY-MM-DD'
        });
      }

      // Create date range in Colombia timezone
      const startDate = new Date(start_date + 'T00:00:00-05:00');
      const endDate = new Date(end_date + 'T23:59:59-05:00');
      
      console.log('🔍 Sales Summary - Rango fechas Colombia:', {
        start_date,
        end_date,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const t = await sequelize.transaction();

      try {
        // 1. Resumen general de ventas
        const [salesSummaryResults] = await sequelize.query(`
          SELECT 
            COUNT(DISTINCT s.sale_id) as total_ventas,
            COALESCE(SUM(s.total), 0) as total_ventas_valor,
            COALESCE(AVG(s.total), 0) as valor_promedio_venta,
            COALESCE(SUM(
              (SELECT COUNT(*) FROM naxos.sale_item WHERE sale_id = s.sale_id)
            ), 0) as total_items_vendidos,
            COALESCE(SUM(
              (SELECT SUM(quantity) FROM naxos.sale_item WHERE sale_id = s.sale_id)
            ), 0) as total_unidades_vendidas
          FROM naxos.sale s
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        // 2. Desglose por método de pago
        const [paymentMethodsResults] = await sequelize.query(`
          SELECT 
            sp.method,
            COUNT(DISTINCT s.sale_id) as cantidad_ventas,
            COALESCE(SUM(sp.amount), 0) as total,
            COUNT(*) as transacciones
          FROM naxos.sale s
          JOIN naxos.sale_payment sp ON s.sale_id = sp.sale_id
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
          GROUP BY sp.method
          ORDER BY total DESC
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        // 3. Producto más vendido
        const [topProductResults] = await sequelize.query(`
          SELECT 
            p.name as product_name,
            COUNT(si.sale_item_id) as total_ventas_producto,
            COALESCE(SUM(si.quantity), 0) as total_unidades_producto,
            COALESCE(SUM(si.line_total), 0) as total_ventas_producto,
            COUNT(DISTINCT s.sale_id) as clientes_unicos
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
          JOIN naxos.product p ON pv.product_id = p.product_id
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
          GROUP BY p.product_id, p.name
          ORDER BY total_ventas_producto DESC
          LIMIT 10
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        // 4. Variante más vendida
        const [topVariantResults] = await sequelize.query(`
          SELECT 
            pv.variant_name,
            p.name as product_name,
            COUNT(si.sale_item_id) as total_ventas_variante,
            COALESCE(SUM(si.quantity), 0) as total_unidades_variante,
            COALESCE(SUM(si.line_total), 0) as total_ventas_variante
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
          JOIN naxos.product p ON pv.product_id = p.product_id
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
          GROUP BY pv.variant_id, pv.variant_name, p.name
          ORDER BY total_ventas_variante DESC
          LIMIT 10
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        // 5. Sabor más vendido
        const [topFlavorResults] = await sequelize.query(`
          SELECT 
            f.name as flavor_name,
            COUNT(si.sale_item_id) as total_ventas_sabor,
            COALESCE(SUM(si.quantity), 0) as total_unidades_sabor,
            COALESCE(SUM(si.line_total), 0) as total_ventas_sabor
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.flavor f ON si.flavor_id = f.flavor_id
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
            AND si.flavor_id IS NOT NULL
          GROUP BY f.flavor_id, f.name
          ORDER BY total_ventas_sabor DESC
          LIMIT 10
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        // 6. Ventas por hora del día
        const [hourlySalesResults] = await sequelize.query(`
          SELECT 
            EXTRACT(HOUR FROM s.opened_at) as hora,
            COUNT(DISTINCT s.sale_id) as cantidad_ventas,
            COALESCE(SUM(s.total), 0) as total_ventas_hora,
            COALESCE(AVG(s.total), 0) as promedio_venta_hora
          FROM naxos.sale s
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
          GROUP BY EXTRACT(HOUR FROM s.opened_at)
          ORDER BY hora
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        // 7. Ventas por tamaño (basado en variantes)
        const [salesBySizeResults] = await sequelize.query(`
          SELECT 
            pv.variant_name as tamaño,
            COUNT(si.sale_item_id) as cantidad_vendida,
            COALESCE(SUM(si.quantity), 0) as total_unidades,
            COALESCE(SUM(si.line_total), 0) as total_ventas,
            COUNT(DISTINCT s.sale_id) as ventas_unicas
          FROM naxos.sale s
          JOIN naxos.sale_item si ON s.sale_id = si.sale_id
          JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
          WHERE s.opened_at BETWEEN :startDate AND :endDate
            AND s.status = 'PAID'
          GROUP BY pv.variant_id, pv.variant_name
          ORDER BY total_ventas DESC
        `, {
          transaction: t,
          replacements: { startDate, endDate }
        });

        await t.commit();

        const salesData = salesSummaryResults[0];
        
        // Procesar resultados de métodos de pago
        const paymentMethods = paymentMethodsResults.map(pm => ({
          method: pm.method === 'CASH' ? 'EFECTIVO' : 
                 pm.method === 'TRANSFER' ? 'TRANSFERENCIA' :
                 pm.method === 'CARD' ? 'TARJETA' : 'OTRO',
          cantidad_ventas: parseInt(pm.cantidad_ventas),
          total: parseFloat(pm.total),
          transacciones: parseInt(pm.transacciones)
        }));

        const reportData = {
          periodo: {
            start_date,
            end_date,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          resumen: {
            total_ventas: parseInt(salesData.total_ventas),
            total_ventas_valor: parseFloat(salesData.total_ventas_valor),
            valor_promedio_venta: parseFloat(salesData.valor_promedio_venta),
            total_items_vendidos: parseInt(salesData.total_items_vendidos),
            total_unidades_vendidas: parseFloat(salesData.total_unidades_vendidas)
          },
          metodos_pago: paymentMethods,
          top_productos: topProductResults.map(product => ({
            product_name: product.product_name,
            total_ventas_producto: parseInt(product.total_ventas_producto),
            total_unidades_producto: parseInt(product.total_unidades_producto),
            total_ventas_producto: parseFloat(product.total_ventas_producto),
            clientes_unicos: parseInt(product.clientes_unicos)
          })),
          top_variantes: topVariantResults.map(variant => ({
            variant_name: variant.variant_name,
            product_name: variant.product_name,
            total_ventas_variante: parseInt(variant.total_ventas_variante),
            total_unidades_variante: parseInt(variant.total_unidades_variante),
            total_ventas_variante: parseFloat(variant.total_ventas_variante)
          })),
          top_sabores: topFlavorResults.map(flavor => ({
            flavor_name: flavor.flavor_name,
            total_ventas_sabor: parseInt(flavor.total_ventas_sabor),
            total_unidades_sabor: parseInt(flavor.total_unidades_sabor),
            total_ventas_sabor: parseFloat(flavor.total_ventas_sabor)
          })),
          ventas_por_hora: hourlySalesResults.map(hour => ({
            hora: parseInt(hour.hora),
            cantidad_ventas: parseInt(hour.cantidad_ventas),
            total_ventas_hora: parseFloat(hour.total_ventas_hora),
            promedio_venta_hora: parseFloat(hour.promedio_venta_hora)
          })),
          ventas_por_tamaño: salesBySizeResults.map(size => ({
            tamaño: size.tamaño,
            cantidad_vendida: parseInt(size.cantidad_vendida),
            total_unidades: parseInt(size.total_unidades),
            total_ventas: parseFloat(size.total_ventas),
            ventas_unicas: parseInt(size.ventas_unicas)
          }))
        };

        console.log('🔍 Sales Summary Report generado:', {
          periodo: reportData.periodo,
          resumen: reportData.resumen,
          total_metodos_pago: reportData.metodos_pago.length,
          total_top_productos: reportData.top_productos.length,
          total_top_variantes: reportData.top_variantes.length,
          total_top_sabores: reportData.top_sabores.length,
          ventas_por_hora_count: reportData.ventas_por_hora.length
        });

        return res.status(200).json({
          message: 'Reporte de resumen de ventas generado exitosamente',
          data: reportData
        });

      } catch (error) {
        await t.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error en ReportsController.getSalesSummary:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar el reporte de resumen de ventas',
        details: error.message
      });
    }
  }

  // Descarga de reporte en PDF/Excel
  static async downloadSalesSummaryReport(req, res) {
    try {
      const { start_date, end_date, format } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({
          error: 'Parámetros requeridos',
          message: 'Se requieren start_date y end_date'
        });
      }

      if (!format || !['pdf', 'excel'].includes(format)) {
        return res.status(400).json({
          error: 'Formato inválido',
          message: 'El formato debe ser pdf o excel'
        });
      }

      // Por ahora, devolvemos el mismo JSON que el reporte normal
      // En una implementación completa, aquí generaríamos el archivo PDF/Excel
      const reportResponse = await this.getSalesSummary({
        query: { start_date, end_date }
      }, {
        status: (code) => ({
          json: (data) => data
        })
      });

      const reportData = reportResponse.data;

      if (format === 'pdf') {
        // TODO: Implementar generación de PDF
        return res.status(200).json({
          message: 'Descarga PDF no implementada aún',
          data: reportData
        });
      } else if (format === 'excel') {
        // TODO: Implementar generación de Excel
        return res.status(200).json({
          message: 'Descarga Excel no implementada aún',
          data: reportData
        });
      }

    } catch (error) {
      console.error('Error en ReportsController.downloadSalesSummaryReport:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo generar la descarga del reporte',
        details: error.message
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
