const { query } = require('../config/database');
const Joi = require('joi');

// Esquemas de validación
const locationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  is_active: Joi.boolean().default(true)
});

const movementSchema = Joi.object({
  location_id: Joi.number().integer().positive().required(),
  variant_id: Joi.number().integer().positive().required(),
  movement_type: Joi.string().valid('PURCHASE', 'ADJUSTMENT', 'SALE', 'RETURN').required(),
  qty_change: Joi.number().precision(3).required(),
  reason: Joi.string().max(500).optional(),
  ref_sale_id: Joi.number().integer().positive().optional()
});

const stockUpdateSchema = Joi.object({
  location_id: Joi.number().integer().positive().required(),
  variant_id: Joi.number().integer().positive().required(),
  qty_on_hand: Joi.number().precision(3).min(0).required()
});

const supplySchema = Joi.object({
  location_id: Joi.number().integer().positive().required(),
  item_name: Joi.string().min(2).max(100).required(),
  quantity: Joi.number().precision(3).positive().required(),
  reason: Joi.string().max(500).optional()
});

class InventoryController {
  
  // ==================== UBICACIONES ====================
  
  // Crear ubicación de inventario
  static async createLocation(req, res) {
    try {
      const { error, value } = locationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { name, is_active } = value;

      const result = await query(
        'INSERT INTO naxos.inventory_location (name, is_active) VALUES ($1, $2) RETURNING *',
        [name, is_active]
      );

      res.status(201).json({
        success: true,
        message: 'Ubicación creada exitosamente',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error creando ubicación:', error);
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Ubicación ya existe',
          message: 'Ya existe una ubicación con ese nombre'
        });
      }
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear la ubicación'
      });
    }
  }

  // Obtener todas las ubicaciones
  static async getLocations(req, res) {
    try {
      const result = await query(
        'SELECT * FROM naxos.inventory_location ORDER BY name ASC'
      );

      res.status(200).json({
        success: true,
        message: 'Ubicaciones obtenidas exitosamente',
        data: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo ubicaciones:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las ubicaciones',
        details: error.message
      });
    }
  }

  // ==================== STOCK ACTUAL ====================
  
  // Obtener stock actual por ubicación
  static async getStockByLocation(req, res) {
    try {
      const locationId = parseInt(req.params.locationId);

      const result = await query(`
        SELECT 
          stock.location_id,
          stock.variant_id,
          stock.qty_on_hand,
          stock.updated_at,
          pv.product_id,
          pv.variant_name,
          pv.ounces,
          pv.sku,
          p.name as product_name,
          c.name as category_name,
          loc.name as location_name
        FROM naxos.inventory_stock stock
        JOIN naxos.inventory_location loc ON stock.location_id = loc.location_id
        JOIN naxos.product_variant pv ON stock.variant_id = pv.variant_id
        JOIN naxos.product p ON pv.product_id = p.product_id
        LEFT JOIN naxos.product_category c ON p.category_id = c.category_id
        WHERE stock.location_id = $1
        ORDER BY p.name, pv.variant_name
      `, [locationId]);

      res.status(200).json({
        success: true,
        message: 'Stock obtenido exitosamente',
        data: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo stock:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el stock'
      });
    }
  }

  // Obtener stock actual de una variante específica
  static async getStockByVariant(req, res) {
    try {
      const variantId = parseInt(req.params.variantId);

      const result = await query(`
        SELECT 
          stock.location_id,
          stock.variant_id,
          stock.qty_on_hand,
          stock.updated_at,
          loc.name as location_name,
          loc.is_active as location_active
        FROM naxos.inventory_stock stock
        JOIN naxos.inventory_location loc ON stock.location_id = loc.location_id
        WHERE stock.variant_id = $1 AND loc.is_active = true
        ORDER BY loc.name
      `, [variantId]);

      res.status(200).json({
        success: true,
        message: 'Stock de variante obtenido exitosamente',
        data: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo stock de variante:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el stock de la variante'
      });
    }
  }

  // Actualizar stock manualmente
  static async updateStock(req, res) {
    try {
      const { error, value } = stockUpdateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { location_id, variant_id, qty_on_hand } = value;

      // Verificar que la ubicación y variante existen
      const locationExists = await query(
        'SELECT location_id FROM naxos.inventory_location WHERE location_id = $1 AND is_active = true',
        [location_id]
      );

      const variantExists = await query(
        'SELECT variant_id FROM naxos.product_variant WHERE variant_id = $1 AND is_active = true',
        [variant_id]
      );

      if (locationExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Ubicación no encontrada',
          message: 'La ubicación especificada no existe o está inactiva'
        });
      }

      if (variantExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe o está inactiva'
        });
      }

      const result = await query(`
        INSERT INTO naxos.inventory_stock (location_id, variant_id, qty_on_hand, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (location_id, variant_id)
        DO UPDATE SET 
          qty_on_hand = EXCLUDED.qty_on_hand,
          updated_at = now()
        RETURNING *
      `, [location_id, variant_id, qty_on_hand]);

      res.status(200).json({
        success: true,
        message: 'Stock actualizado exitosamente',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error actualizando stock:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar el stock'
      });
    }
  }

  // ==================== MOVIMIENTOS DE INVENTARIO ====================
  
  // Registrar movimiento de inventario
  static async createMovement(req, res) {
    try {
      const { error, value } = movementSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { location_id, variant_id, movement_type, qty_change, reason, ref_sale_id } = value;
      const created_by = req.user.user_id;

      // Verificar que la ubicación y variante existen
      const locationExists = await query(
        'SELECT location_id FROM naxos.inventory_location WHERE location_id = $1 AND is_active = true',
        [location_id]
      );

      const variantExists = await query(
        'SELECT variant_id FROM naxos.product_variant WHERE variant_id = $1 AND is_active = true',
        [variant_id]
      );

      if (locationExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Ubicación no encontrada',
          message: 'La ubicación especificada no existe o está inactiva'
        });
      }

      if (variantExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe o está inactiva'
        });
      }

      const result = await query(`
        INSERT INTO naxos.inventory_movement 
        (location_id, variant_id, movement_type, qty_change, reason, ref_sale_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [location_id, variant_id, movement_type, qty_change, reason, ref_sale_id, created_by]);

      // El trigger de la BD actualiza el stock automaticamente

      res.status(201).json({
        success: true,
        message: 'Movimiento registrado exitosamente',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error registrando movimiento:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo registrar el movimiento',
        details: error.message
      });
    }
  }

  // Obtener historial de movimientos
  static async getMovementHistory(req, res) {
    try {
      const { 
        location_id, 
        variant_id, 
        movement_type, 
        start_date, 
        end_date, 
        page = 1, 
        limit = 50 
      } = req.query;

      let whereClause = '';
      let params = [];
      let paramCount = 0;

      if (location_id) {
        paramCount++;
        whereClause += `WHERE im.location_id = $${paramCount}`;
        params.push(parseInt(location_id));
      }

      if (variant_id) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `im.variant_id = $${paramCount}`;
        params.push(parseInt(variant_id));
      }

      if (movement_type) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `im.movement_type = $${paramCount}`;
        params.push(movement_type);
      }

      if (start_date) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `im.created_at >= $${paramCount}`;
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `im.created_at <= $${paramCount}`;
        params.push(end_date);
      }

      const offset = (page - 1) * limit;

      const result = await query(`
        SELECT 
          im.movement_id,
          im.location_id,
          im.variant_id,
          im.movement_type,
          im.qty_change,
          im.reason,
          im.ref_sale_id,
          im.created_at,
          loc.name as location_name,
          pv.variant_name,
          pv.ounces,
          p.name as product_name,
          c.name as category_name,
          u.username as created_by_username
        FROM naxos.inventory_movement im
        JOIN naxos.inventory_location loc ON im.location_id = loc.location_id
        JOIN naxos.product_variant pv ON im.variant_id = pv.variant_id
        JOIN naxos.product p ON pv.product_id = p.product_id
        JOIN naxos.product_category c ON p.category_id = c.category_id
        LEFT JOIN naxos.users u ON im.created_by = u.user_id
        ${whereClause}
        ORDER BY im.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      // Obtener total para paginación
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM naxos.inventory_movement im
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      res.status(200).json({
        success: true,
        message: 'Historial de movimientos obtenido exitosamente',
        data: result.rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error obteniendo historial de movimientos:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el historial de movimientos'
      });
    }
  }

  // ==================== REPORTES DE INVENTARIO ====================
  
  // Obtener productos con stock bajo
  static async getLowStock(req, res) {
    try {
      const { location_id, threshold = 10 } = req.query;
      
      let whereClause = 'WHERE stock.qty_on_hand <= $1';
      let params = [parseInt(threshold)];

      if (location_id) {
        whereClause += ' AND stock.location_id = $2';
        params.push(parseInt(location_id));
      }

      const result = await query(`
        SELECT 
          stock.location_id,
          stock.variant_id,
          stock.qty_on_hand,
          stock.updated_at,
          pv.product_id,
          pv.variant_name,
          pv.ounces,
          p.name as product_name,
          c.name as category_name,
          loc.name as location_name
        FROM naxos.inventory_stock stock
        JOIN naxos.inventory_location loc ON stock.location_id = loc.location_id
        JOIN naxos.product_variant pv ON stock.variant_id = pv.variant_id
        JOIN naxos.product p ON pv.product_id = p.product_id
        JOIN naxos.product_category c ON p.category_id = c.category_id
        ${whereClause}
        ORDER BY stock.qty_on_hand ASC, p.name, pv.variant_name
      `, params);

      res.status(200).json({
        success: true,
        message: 'Productos con stock bajo obtenidos exitosamente',
        data: result.rows,
        threshold: parseInt(threshold)
      });

    } catch (error) {
      console.error('Error obteniendo stock bajo:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el reporte de stock bajo'
      });
    }
  }

  // Obtener resumen de inventario por categoría
  static async getInventorySummary(req, res) {
    try {
      const { location_id } = req.query;
      
      let whereClause = '';
      let params = [];

      if (location_id) {
        whereClause = 'WHERE stock.location_id = $1';
        params.push(parseInt(location_id));
      }

      const result = await query(`
        SELECT 
          c.category_id,
          c.name as category_name,
          COUNT(DISTINCT pv.variant_id) as total_variants,
          SUM(stock.qty_on_hand) as total_quantity,
          AVG(stock.qty_on_hand) as avg_quantity,
          MIN(stock.qty_on_hand) as min_quantity,
          MAX(stock.qty_on_hand) as max_quantity
        FROM naxos.product_category c
        JOIN naxos.product p ON c.category_id = p.category_id
        JOIN naxos.product_variant pv ON p.product_id = pv.product_id
        JOIN naxos.inventory_stock stock ON pv.variant_id = stock.variant_id
        ${whereClause}
        GROUP BY c.category_id, c.name
        ORDER BY c.name
      `, params);

      res.status(200).json({
        success: true,
        message: 'Resumen de inventario obtenido exitosamente',
        data: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo resumen de inventario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el resumen de inventario'
      });
    }
  }

  // ==================== INGRESO DE INSUMOS ====================

  // Registra un ingreso de inventario por nombre de insumo.
  // Si el producto/variante no existe, lo crea automáticamente.
  static async createSupply(req, res) {
    try {
      const { error, value } = supplySchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { location_id, item_name, quantity, reason } = value;
      const created_by = req.user.user_id;

      // Extraer onzas del nombre si el texto contiene un numero seguido de oz/onzas
      const ouncesMatch = item_name.match(/(\d+(?:\.\d+)?)\s?(?:oz|onzas?)/i);
      const ounces = ouncesMatch ? parseFloat(ouncesMatch[1]) : null;

      // Verificar que la ubicación existe
      const locationResult = await query(
        'SELECT location_id FROM naxos.inventory_location WHERE location_id = $1 AND is_active = true',
        [location_id]
      );

      if (locationResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Ubicación no encontrada',
          message: 'La ubicación especificada no existe o está inactiva'
        });
      }

      // Buscar producto/variante existente que coincida con el nombre
      let variantId = null;

      if (ounces) {
        const variantResult = await query(`
          SELECT pv.variant_id
          FROM naxos.product p
          JOIN naxos.product_variant pv ON p.product_id = pv.product_id
          WHERE p.name ILIKE $1
            AND pv.ounces = $2
            AND pv.is_active = true
          LIMIT 1
        `, [`%${item_name}%`, ounces]);
        if (variantResult.rows.length > 0) {
          variantId = variantResult.rows[0].variant_id;
        }
      } else {
        const variantResult = await query(`
          SELECT pv.variant_id
          FROM naxos.product p
          JOIN naxos.product_variant pv ON p.product_id = pv.product_id
          WHERE p.name ILIKE $1
            AND pv.is_active = true
          LIMIT 1
        `, [`%${item_name}%`]);
        if (variantResult.rows.length > 0) {
          variantId = variantResult.rows[0].variant_id;
        }
      }

      // Si no existe, crear categoria, producto y variante
      if (!variantId) {
        const categoryResult = await query(
          'SELECT category_id FROM naxos.product_category WHERE name ILIKE $1 LIMIT 1',
          ['%insumos%']
        );

        let categoryId = categoryResult.rows[0]?.category_id;
        if (!categoryId) {
          const newCategory = await query(
            'INSERT INTO naxos.product_category (name) VALUES ($1) RETURNING category_id',
            ['Insumos']
          );
          categoryId = newCategory.rows[0].category_id;
        }

        const productResult = await query(
          'INSERT INTO naxos.product (category_id, name, is_active, created_at, updated_at) VALUES ($1, $2, true, NOW(), NOW()) RETURNING product_id',
          [categoryId, item_name]
        );
        const productId = productResult.rows[0].product_id;

        const newVariant = await query(
          'INSERT INTO naxos.product_variant (product_id, variant_name, ounces, toppings, price, is_active, created_at, updated_at) VALUES ($1, $2, $3, 0, 0, true, NOW(), NOW()) RETURNING variant_id',
          [productId, item_name, ounces]
        );
        variantId = newVariant.rows[0].variant_id;
      }

      const movementResult = await query(`
        INSERT INTO naxos.inventory_movement
        (location_id, variant_id, movement_type, qty_change, reason, created_by)
        VALUES ($1, $2, 'PURCHASE', $3, $4, $5)
        RETURNING *
      `, [location_id, variantId, quantity, reason || `Ingreso de ${item_name}`, created_by]);

      // El trigger de la BD actualiza el stock automaticamente

      res.status(201).json({
        success: true,
        message: 'Ingreso de inventario registrado exitosamente',
        data: movementResult.rows[0]
      });

    } catch (error) {
      console.error('Error registrando ingreso de inventario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo registrar el ingreso de inventario',
        details: error.message
      });
    }
  }
}

module.exports = InventoryController;
