const { query } = require('../config/database');
const Joi = require('joi');

// Esquemas de validación
const openShiftSchema = Joi.object({
  location_id: Joi.number().integer().positive().required(),
  opening_float: Joi.number().precision(2).min(0).required()
});

const closeShiftSchema = Joi.object({
  closing_cash_counted: Joi.number().precision(2).min(0).required(),
  notes: Joi.string().max(500).optional()
});

class ShiftsController {
  
  // ==================== GESTIÓN DE TURNOS ====================
  
  // Abrir nuevo turno
  static async openShift(req, res) {
    try {
      const { error, value } = openShiftSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { location_id, opening_float } = value;
      const opened_by = req.user.user_id;

      // Verificar que no hay un turno abierto para esta ubicación
      const activeShift = await query(
        'SELECT shift_id FROM naxos.cash_shift WHERE location_id = $1 AND is_closed = false',
        [location_id]
      );

      if (activeShift.rows.length > 0) {
        return res.status(400).json({
          error: 'Turno ya abierto',
          message: 'Ya existe un turno abierto para esta ubicación'
        });
      }

      // Verificar que la ubicación existe y está activa
      const locationExists = await query(
        'SELECT location_id FROM naxos.inventory_location WHERE location_id = $1 AND is_active = true',
        [location_id]
      );

      if (locationExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Ubicación no encontrada',
          message: 'La ubicación especificada no existe o está inactiva'
        });
      }

      const result = await query(`
        INSERT INTO naxos.cash_shift (location_id, opened_by, opening_float)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [location_id, opened_by, opening_float]);

      const shift = result.rows[0];

      res.status(201).json({
        message: 'Turno abierto exitosamente',
        shift
      });

    } catch (error) {
      console.error('Error abriendo turno:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo abrir el turno'
      });
    }
  }

  // Obtener turno activo por ubicación
  static async getActiveShift(req, res) {
    try {
      const locationId = parseInt(req.params.locationId);

      const result = await query(`
        SELECT 
          cs.*,
          loc.name as location_name,
          u1.username as opened_by_username,
          u2.username as closed_by_username
        FROM naxos.cash_shift cs
        LEFT JOIN naxos.inventory_location loc ON cs.location_id = loc.location_id
        LEFT JOIN naxos.users u1 ON cs.opened_by = u1.user_id
        LEFT JOIN naxos.users u2 ON cs.closed_by = u2.user_id
        WHERE cs.location_id = $1 AND cs.is_closed = false
        ORDER BY cs.opened_at DESC
        LIMIT 1
      `, [locationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'No hay turno activo',
          message: 'No hay ningún turno abierto para esta ubicación'
        });
      }

      const shift = result.rows[0];

      // Obtener estadísticas del turno
      const stats = await this.getShiftStats(shift.shift_id);

      res.status(200).json({
        message: 'Turno activo obtenido exitosamente',
        shift: {
          ...shift,
          stats
        }
      });

    } catch (error) {
      console.error('Error obteniendo turno activo:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el turno activo'
      });
    }
  }

  // Cerrar turno
  static async closeShift(req, res) {
    try {
      const shiftId = parseInt(req.params.shiftId);
      const { error, value } = closeShiftSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { closing_cash_counted, notes } = value;
      const closed_by = req.user.user_id;

      // Verificar que el turno existe y está abierto
      const shiftExists = await query(
        'SELECT shift_id FROM naxos.cash_shift WHERE shift_id = $1 AND is_closed = false',
        [shiftId]
      );

      if (shiftExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Turno no encontrado o ya cerrado',
          message: 'El turno especificado no existe o ya está cerrado'
        });
      }

      // Llamar a la función PostgreSQL para cerrar el turno
      await query('SELECT naxos.close_shift($1, $2, $3)', [
        shiftId, 
        closed_by, 
        closing_cash_counted
      ]);

      // Obtener el resumen del turno cerrado
      const shiftResult = await query(`
        SELECT 
          cs.*,
          loc.name as location_name,
          u1.username as opened_by_username,
          u2.username as closed_by_username,
          css.total_sales,
          css.total_cash,
          css.total_card,
          css.total_transfer,
          css.total_other,
          css.total_orders
        FROM naxos.cash_shift cs
        LEFT JOIN naxos.inventory_location loc ON cs.location_id = loc.location_id
        LEFT JOIN naxos.users u1 ON cs.opened_by = u1.user_id
        LEFT JOIN naxos.users u2 ON cs.closed_by = u2.user_id
        LEFT JOIN naxos.cash_shift_summary css ON cs.shift_id = css.shift_id
        WHERE cs.shift_id = $1
      `, [shiftId]);

      const closedShift = shiftResult.rows[0];

      // Calcular diferencia
      const difference = closing_cash_counted - (closedShift.opening_float + closedShift.total_cash);

      res.status(200).json({
        message: 'Turno cerrado exitosamente',
        shift: {
          ...closedShift,
          difference,
          difference_formatted: difference >= 0 ? `+$${difference.toFixed(2)}` : `-$${Math.abs(difference).toFixed(2)}`
        }
      });

    } catch (error) {
      console.error('Error cerrando turno:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo cerrar el turno'
      });
    }
  }

  // Obtener estadísticas del turno
  static async getShiftStats(shiftId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(s.sale_id) as total_sales,
          COUNT(CASE WHEN s.status = 'PAID' THEN 1 END) as paid_sales,
          COUNT(CASE WHEN s.status = 'CANCELLED' THEN 1 END) as cancelled_sales,
          COALESCE(SUM(CASE WHEN s.status = 'PAID' THEN s.total END), 0) as total_revenue,
          COALESCE(AVG(CASE WHEN s.status = 'PAID' THEN s.total END), 0) as avg_sale_amount
        FROM naxos.sale s
        JOIN naxos.cash_shift cs ON s.location_id = cs.location_id
        WHERE cs.shift_id = $1 AND s.status = 'PAID'
      `, [shiftId]);

      const stats = result.rows[0];

      // Ventas por método de pago
      const paymentStats = await query(`
        SELECT 
          sp.method,
          COUNT(*) as count,
          COALESCE(SUM(sp.amount), 0) as total_amount
        FROM naxos.sale_payment sp
        JOIN naxos.sale s ON sp.sale_id = s.sale_id
        JOIN naxos.cash_shift cs ON s.location_id = cs.location_id
        WHERE cs.shift_id = $1 AND s.status = 'PAID'
        GROUP BY sp.method
        ORDER BY total_amount DESC
      `, [shiftId]);

      // Productos más vendidos en el turno
      const topProducts = await query(`
        SELECT 
          pv.variant_name,
          pv.ounces,
          p.name as product_name,
          SUM(si.quantity) as total_sold,
          SUM(si.line_total) as total_revenue
        FROM naxos.sale_item si
        JOIN naxos.sale s ON si.sale_id = s.sale_id
        JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
        JOIN naxos.product p ON pv.product_id = p.product_id
        JOIN naxos.cash_shift cs ON s.location_id = cs.location_id
        WHERE cs.shift_id = $1 AND s.status = 'PAID'
        GROUP BY pv.variant_id, pv.variant_name, pv.ounces, p.name
        ORDER BY total_sold DESC
        LIMIT 5
      `, [shiftId]);

      return {
        ...stats,
        total_revenue: parseFloat(stats.total_revenue),
        avg_sale_amount: parseFloat(stats.avg_sale_amount),
        payment_methods: paymentStats.rows,
        top_products: topProducts.rows.map(row => ({
          ...row,
          total_revenue: parseFloat(row.total_revenue),
          total_sold: parseFloat(row.total_sold)
        }))
      };

    } catch (error) {
      console.error('Error obteniendo estadísticas del turno:', error);
      return null;
    }
  }

  // ==================== HISTORIAL DE TURNOS ====================
  
  // Obtener historial de turnos
  static async getShiftHistory(req, res) {
    try {
      const { 
        location_id, 
        start_date, 
        end_date, 
        page = 1, 
        limit = 20 
      } = req.query;

      let whereClause = 'WHERE cs.is_closed = true';
      let params = [];
      let paramCount = 0;

      if (location_id) {
        paramCount++;
        whereClause += ` AND cs.location_id = $${paramCount}`;
        params.push(parseInt(location_id));
      }

      if (start_date) {
        paramCount++;
        whereClause += ` AND cs.opened_at >= $${paramCount}`;
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        whereClause += ` AND cs.opened_at <= $${paramCount}`;
        params.push(end_date);
      }

      const offset = (page - 1) * limit;

      const result = await query(`
        SELECT 
          cs.shift_id,
          cs.location_id,
          cs.opened_by,
          cs.closed_by,
          cs.opened_at,
          cs.closed_at,
          cs.opening_float,
          cs.closing_cash_counted,
          cs.notes,
          cs.is_closed,
          loc.name as location_name,
          u1.username as opened_by_username,
          u2.username as closed_by_username,
          css.total_sales,
          css.total_cash,
          css.total_card,
          css.total_transfer,
          css.total_other,
          css.total_orders
        FROM naxos.cash_shift cs
        LEFT JOIN naxos.inventory_location loc ON cs.location_id = loc.location_id
        LEFT JOIN naxos.users u1 ON cs.opened_by = u1.user_id
        LEFT JOIN naxos.users u2 ON cs.closed_by = u2.user_id
        LEFT JOIN naxos.cash_shift_summary css ON cs.shift_id = css.shift_id
        ${whereClause}
        ORDER BY cs.opened_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      // Obtener total para paginación
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM naxos.cash_shift cs
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Calcular diferencias
      const shifts = result.rows.map(shift => {
        const difference = shift.closing_cash_counted - (shift.opening_float + shift.total_cash);
        return {
          ...shift,
          difference,
          difference_formatted: difference >= 0 ? `+$${difference.toFixed(2)}` : `-$${Math.abs(difference).toFixed(2)}`,
          total_sales: parseFloat(shift.total_sales),
          total_cash: parseFloat(shift.total_cash),
          total_card: parseFloat(shift.total_card),
          total_transfer: parseFloat(shift.total_transfer),
          total_other: parseFloat(shift.total_other)
        };
      });

      res.status(200).json({
        message: 'Historial de turnos obtenido exitosamente',
        shifts,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error obteniendo historial de turnos:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el historial de turnos'
      });
    }
  }

  // Obtener turno específico por ID
  static async getShiftById(req, res) {
    try {
      const shiftId = parseInt(req.params.id);

      const result = await query(`
        SELECT 
          cs.*,
          loc.name as location_name,
          u1.username as opened_by_username,
          u2.username as closed_by_username,
          css.total_sales,
          css.total_cash,
          css.total_card,
          css.total_transfer,
          css.total_other,
          css.total_orders
        FROM naxos.cash_shift cs
        LEFT JOIN naxos.inventory_location loc ON cs.location_id = loc.location_id
        LEFT JOIN naxos.users u1 ON cs.opened_by = u1.user_id
        LEFT JOIN naxos.users u2 ON cs.closed_by = u2.user_id
        LEFT JOIN naxos.cash_shift_summary css ON cs.shift_id = css.shift_id
        WHERE cs.shift_id = $1
      `, [shiftId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Turno no encontrado',
          message: 'El turno especificado no existe'
        });
      }

      const shift = result.rows[0];
      
      // Si el turno está cerrado, obtener estadísticas
      let stats = null;
      if (shift.is_closed) {
        stats = await this.getShiftStats(shiftId);
      }

      // Calcular diferencia si está cerrado
      let difference = null;
      let difference_formatted = null;
      if (shift.is_closed && shift.closing_cash_counted !== null) {
        difference = shift.closing_cash_counted - (shift.opening_float + shift.total_cash);
        difference_formatted = difference >= 0 ? `+$${difference.toFixed(2)}` : `-$${Math.abs(difference).toFixed(2)}`;
      }

      res.status(200).json({
        message: 'Turno obtenido exitosamente',
        shift: {
          ...shift,
          stats,
          difference,
          difference_formatted,
          total_sales: parseFloat(shift.total_sales),
          total_cash: parseFloat(shift.total_cash),
          total_card: parseFloat(shift.total_card),
          total_transfer: parseFloat(shift.total_transfer),
          total_other: parseFloat(shift.total_other)
        }
      });

    } catch (error) {
      console.error('Error obteniendo turno:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el turno'
      });
    }
  }
}

module.exports = ShiftsController;
