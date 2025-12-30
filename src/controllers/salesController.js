const { query } = require('../config/database');
const Joi = require('joi');

// Esquemas de validación
const saleSchema = Joi.object({
  location_id: Joi.number().integer().positive().required(),
  customer_note: Joi.string().max(500).optional()
});

const saleItemSchema = Joi.object({
  variant_id: Joi.number().integer().positive().required(),
  flavor_id: Joi.number().integer().positive().optional(),
  quantity: Joi.number().precision(3).positive().required(),
  unit_price: Joi.number().precision(2).positive().optional()
});

const paymentSchema = Joi.object({
  method: Joi.string().valid('CASH', 'CARD', 'TRANSFER', 'OTHER').required(),
  amount: Joi.number().precision(2).positive().required(),
  reference: Joi.string().max(100).optional()
});

class SalesController {

  // Crear nueva venta
  static async createSale(req, res) {
    try {
      const { error, value } = saleSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { location_id, customer_note } = value;
      const cashier_id = req.user.user_id;

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
        INSERT INTO naxos.sale (location_id, cashier_id, customer_note)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [location_id, cashier_id, customer_note]);

      const sale = result.rows[0];

      res.status(201).json({
        message: 'Venta creada exitosamente',
        sale
      });

    } catch (error) {
      console.error('Error creando venta:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear la venta'
      });
    }
  }

  // Obtener venta por ID
  static async getSaleById(req, res) {
    try {
      const saleId = parseInt(req.params.id);

      const result = await query(`
        SELECT
          s.*,
          loc.name as location_name,
          u.username as cashier_username,
          json_agg(
            json_build_object(
              'sale_item_id', si.sale_item_id,
              'variant_id', si.variant_id,
              'flavor_id', si.flavor_id,
              'quantity', si.quantity,
              'unit_price', si.unit_price,
              'line_total', si.line_total,
              'variant_name', pv.variant_name,
              'ounces', pv.ounces,
              'product_name', p.name as product_name,
              'category_name', c.name as category_name,
              'flavor_name', f.name as flavor_name
            )
          ) FILTER (WHERE si.sale_item_id IS NOT NULL) as items,
          json_agg(
            json_build_object(
              'payment_id', sp.payment_id,
              'method', sp.method,
              'amount', sp.amount,
              'paid_at', sp.paid_at,
              'reference', sp.reference
            )
          ) FILTER (WHERE sp.payment_id IS NOT NULL) as payments
        FROM naxos.sale s
        LEFT JOIN naxos.inventory_location loc ON s.location_id = loc.location_id
        LEFT JOIN naxos.users u ON s.cashier_id = u.user_id
        LEFT JOIN naxos.sale_item si ON s.sale_id = si.sale_id
        LEFT JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
        LEFT JOIN naxos.product p ON pv.product_id = p.product_id
        LEFT JOIN naxos.product_category c ON p.category_id = c.category_id
        LEFT JOIN naxos.flavor f ON si.flavor_id = f.flavor_id
        LEFT JOIN naxos.sale_payment sp ON s.sale_id = sp.sale_id
        WHERE s.sale_id = $1
        GROUP BY s.sale_id, loc.name, u.username
      `, [saleId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Venta no encontrada',
          message: 'La venta especificada no existe'
        });
      }

      const sale = result.rows[0];

      // Calcular totales si no están calculados
      if (sale.subtotal === 0 && sale.items && sale.items.length > 0) {
        const subtotal = sale.items.reduce((sum, item) => sum + parseFloat(item.line_total), 0);
        await query(
          'UPDATE naxos.sale SET subtotal = $1, total = $1 WHERE sale_id = $2',
          [subtotal, saleId]
        );
        sale.subtotal = subtotal;
        sale.total = subtotal;
      }

      res.status(200).json({
        message: 'Venta obtenida exitosamente',
        sale
      });

    } catch (error) {
      console.error('Error obteniendo venta:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la venta'
      });
    }
  }

  // Obtener lista de ventas
  static async getSales(req, res) {
    try {
      const {
        status,
        location_id,
        cashier_id,
        start_date,
        end_date,
        page = 1,
        limit = 20
      } = req.query;

      let whereClause = '';
      let params = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        whereClause += `WHERE s.status = $${paramCount}`;
        params.push(status);
      }

      if (location_id) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `s.location_id = $${paramCount}`;
        params.push(parseInt(location_id));
      }

      if (cashier_id) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `s.cashier_id = $${paramCount}`;
        params.push(cashier_id);
      }

      if (start_date) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `s.opened_at >= $${paramCount}`;
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `s.opened_at <= $${paramCount}`;
        params.push(end_date);
      }

      const offset = (page - 1) * limit;

      const result = await query(`
        SELECT
          s.sale_id,
          s.sale_number,
          s.status,
          s.location_id,
          s.cashier_id,
          s.customer_note,
          s.opened_at,
          s.paid_at,
          s.cancelled_at,
          s.subtotal,
          s.tax,
          s.total,
          loc.name as location_name,
          u.username as cashier_username,
          COUNT(si.sale_item_id) as total_items
        FROM naxos.sale s
        LEFT JOIN naxos.inventory_location loc ON s.location_id = loc.location_id
        LEFT JOIN naxos.users u ON s.cashier_id = u.user_id
        LEFT JOIN naxos.sale_item si ON s.sale_id = si.sale_id
        ${whereClause}
        GROUP BY s.sale_id, loc.name, u.username
        ORDER BY s.opened_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      // Obtener total para paginación
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM naxos.sale s
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      res.status(200).json({
        message: 'Ventas obtenidas exitosamente',
        sales: result.rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error obteniendo ventas:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las ventas'
      });
    }
  }

  // Cancelar venta
  static async cancelSale(req, res) {
    try {
      const saleId = parseInt(req.params.id);
      const { reason } = req.body;

      // Verificar que la venta existe
      const saleResult = await query(
        'SELECT sale_id, status, total FROM naxos.sale WHERE sale_id = $1',
        [saleId]
      );

      if (saleResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Venta no encontrada',
          message: 'La venta especificada no existe'
        });
      }

      const sale = saleResult.rows[0];

      if (sale.status === 'CANCELLED') {
        return res.status(400).json({
          error: 'Venta ya cancelada',
          message: 'La venta ya ha sido cancelada previamente'
        });
      }

      if (sale.status === 'PAID') {
        return res.status(400).json({
          error: 'Venta pagada',
          message: 'No se puede cancelar una venta que ya fue pagada'
        });
      }

      // Cancelar la venta
      await query(
        'UPDATE naxos.sale SET status = \'CANCELLED\', cancelled_at = NOW(), cancellation_reason = $1 WHERE sale_id = $2',
        [reason || 'Cancelada por el cajero', saleId]
      );

      res.status(200).json({
        message: 'Venta cancelada exitosamente',
        sale_id: saleId,
        reason: reason || 'Cancelada por el cajero'
      });

    } catch (error) {
      console.error('Error cancelando venta:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo cancelar la venta'
      });
    }
  }

  // Agregar item a venta
  static async addSaleItem(req, res) {
    try {
      const saleId = parseInt(req.params.saleId);
      const { error, value } = saleItemSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { variant_id, flavor_id, quantity, unit_price } = value;

      // Verificar que la venta existe y está abierta
      const saleExists = await query(
        'SELECT sale_id, status FROM naxos.sale WHERE sale_id = $1',
        [saleId]
      );

      if (saleExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Venta no encontrada',
          message: 'La venta especificada no existe'
        });
      }

      if (saleExists.rows[0].status !== 'OPEN') {
        return res.status(400).json({
          error: 'Venta cerrada',
          message: 'No se pueden agregar items a una venta que no está abierta'
        });
      }

      const result = await query(`
        INSERT INTO naxos.sale_item (sale_id, variant_id, flavor_id, quantity, unit_price)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [saleId, variant_id, flavor_id, quantity, unit_price]);

      res.status(201).json({
        message: 'Item agregado a la venta exitosamente',
        item: result.rows[0]
      });

    } catch (error) {
      console.error('Error agregando item a venta:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo agregar el item a la venta'
      });
    }
  }

  // Actualizar cantidad de item
  static async updateSaleItem(req, res) {
    try {
      const itemId = parseInt(req.params.itemId);
      const { quantity, unit_price } = req.body;

      if (quantity !== undefined && quantity <= 0) {
        return res.status(400).json({
          error: 'Cantidad inválida',
          message: 'La cantidad debe ser un número mayor a 0'
        });
      }

      if (unit_price !== undefined && unit_price <= 0) {
        return res.status(400).json({
          error: 'Precio unitario inválido',
          message: 'El precio unitario debe ser un número mayor a 0'
        });
      }

      let updateQuery = 'UPDATE naxos.sale_item SET';
      let params = [];
      let paramCount = 0;

      if (quantity !== undefined) {
        paramCount++;
        updateQuery += ` quantity = $${paramCount},`;
        params.push(quantity);
      }

      if (unit_price !== undefined) {
        paramCount++;
        updateQuery += ` unit_price = $${paramCount},`;
        params.push(unit_price);
      }

      updateQuery = updateQuery.slice(0, -1);

      paramCount++;
      updateQuery += ` WHERE sale_item_id = $${paramCount}`;
      params.push(itemId);

      updateQuery += ' RETURNING *';

      const result = await query(updateQuery, params);

      res.status(200).json({
        message: 'Item actualizado exitosamente',
        item: result.rows[0]
      });

    } catch (error) {
      console.error('Error actualizando item:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar el item'
      });
    }
  }

  // Eliminar item de venta
  static async removeSaleItem(req, res) {
    try {
      const itemId = parseInt(req.params.itemId);

      await query('DELETE FROM naxos.sale_item WHERE sale_item_id = $1', [itemId]);

      res.status(200).json({
        message: 'Item eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando item:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar el item'
      });
    }
  }

  // Procesar pago
  static async processPayment(req, res) {
    try {
      const saleId = parseInt(req.params.saleId);
      const { error, value } = paymentSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { method, amount, reference } = value;

      const result = await query(`
        INSERT INTO naxos.sale_payment (sale_id, method, amount, reference)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [saleId, method, amount, reference]);

      const payment = result.rows[0];

      res.status(201).json({
        message: 'Pago procesado exitosamente',
        payment
      });

    } catch (error) {
      console.error('Error procesando pago:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo procesar el pago'
      });
    }
  }

  // Obtener estadísticas de ventas diarias
  static async getDailySalesStats(req, res) {
    try {
      const { date = new Date().toISOString().split('T')[0] } = req.query;

      const result = await query(`
        SELECT
          DATE(opened_at) as sale_date,
          COUNT(*) as total_sales,
          COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_sales,
          COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_sales,
          SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) as total_revenue,
          AVG(CASE WHEN status = 'PAID' THEN total ELSE NULL END) as average_sale,
          SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as items_sold
        FROM naxos.sale
        WHERE DATE(opened_at) = $1
        GROUP BY DATE(opened_at)
        ORDER BY DATE(opened_at) DESC
      `, [date]);

      const stats = result.rows[0] || {
        sale_date: date,
        total_sales: 0,
        paid_sales: 0,
        cancelled_sales: 0,
        total_revenue: 0,
        average_sale: 0,
        items_sold: 0
      };

      res.status(200).json({
        message: 'Estadísticas obtenidas exitosamente',
        stats
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las estadísticas'
      });
    }
  }

  // Obtener productos más vendidos
  static async getTopSellingProducts(req, res) {
    try {
      const { limit = 10, start_date, end_date } = req.query;

      let dateFilter = '';
      let params = [limit];
      let paramCount = 1;

      if (start_date) {
        paramCount++;
        dateFilter += ` AND s.opened_at >= $${paramCount}`;
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        dateFilter += ` AND s.opened_at <= $${paramCount}`;
        params.push(end_date);
      }

      const result = await query(`
        SELECT
          p.product_id,
          p.name as product_name,
          c.name as category_name,
          COUNT(si.sale_item_id) as total_quantity_sold,
          SUM(si.quantity) as total_units_sold,
          SUM(si.line_total) as total_revenue,
          AVG(si.unit_price) as average_price,
          COUNT(DISTINCT s.sale_id) as number_of_sales
        FROM naxos.sale s
        JOIN naxos.sale_item si ON s.sale_id = si.sale_id
        JOIN naxos.product_variant pv ON si.variant_id = pv.variant_id
        JOIN naxos.product p ON pv.product_id = p.product_id
        JOIN naxos.product_category c ON p.category_id = c.category_id
        WHERE s.status = 'PAID'
        ${dateFilter}
        GROUP BY p.product_id, p.name, c.name
        ORDER BY total_revenue DESC
        LIMIT $1
      `, params);

      res.status(200).json({
        message: 'Productos más vendidos obtenidos exitosamente',
        products: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo productos más vendidos:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los productos más vendidos'
      });
    }
  }
}

module.exports = SalesController;
