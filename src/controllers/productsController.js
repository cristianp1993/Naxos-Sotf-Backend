const { query } = require('../config/database');
const Joi = require('joi');

// Esquemas de validación
const categorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required()
});

const productSchema = Joi.object({
  category_id: Joi.number().integer().positive().required(),
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(500).optional(),
  image_url: Joi.string().uri().optional(),
  is_active: Joi.boolean().default(true)
});

const variantSchema = Joi.object({
  product_id: Joi.number().integer().positive().required(),
  variant_name: Joi.string().min(1).max(100).required(),
  ounces: Joi.number().integer().positive().optional(),
  sku: Joi.string().max(50).optional(),
  image_url: Joi.string().uri().optional(),
  is_active: Joi.boolean().default(true)
});

const priceSchema = Joi.object({
  variant_id: Joi.number().integer().positive().required(),
  price: Joi.number().precision(2).positive().required(),
  valid_from: Joi.date().default('now'),
  valid_to: Joi.date().optional()
});

const flavorSchema = Joi.object({
  name: Joi.string().min(2).max(100).required()
});

class ProductsController {
  
  // ==================== CATEGORÍAS ====================
  
  // Crear categoría
  static async createCategory(req, res) {
    try {
      const { error, value } = categorySchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { name } = value;

      const result = await query(
        'INSERT INTO naxos.product_category (name) VALUES ($1) RETURNING *',
        [name]
      );

      res.status(201).json({
        message: 'Categoría creada exitosamente',
        category: result.rows[0]
      });

    } catch (error) {
      console.error('Error creando categoría:', error);
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({
          error: 'Categoría ya existe',
          message: 'Ya existe una categoría con ese nombre'
        });
      }
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear la categoría'
      });
    }
  }

  // Obtener todas las categorías
  static async getCategories(req, res) {
    try {
      const result = await query(
        'SELECT * FROM naxos.product_category ORDER BY name ASC'
      );

      res.status(200).json({
        message: 'Categorías obtenidas exitosamente',
        categories: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo categorías:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las categorías'
      });
    }
  }

  // ==================== PRODUCTOS ====================
  
  // Crear producto
  static async createProduct(req, res) {
    try {
      const { error, value } = productSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { category_id, name, description, image_url, is_active } = value;

      const result = await query(
        'INSERT INTO naxos.product (category_id, name, description, image_url, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [category_id, name, description, image_url, is_active]
      );

      res.status(201).json({
        message: 'Producto creado exitosamente',
        product: result.rows[0]
      });

    } catch (error) {
      console.error('Error creando producto:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear el producto'
      });
    }
  }

  // Obtener todos los productos con sus categorías y variantes
  static async getProducts(req, res) {
    try {
      const { category_id, is_active } = req.query;
      
      let whereClause = '';
      let params = [];
      let paramCount = 0;

      if (category_id) {
        paramCount++;
        whereClause += `WHERE p.category_id = $${paramCount}`;
        params.push(parseInt(category_id));
      }

      if (is_active !== undefined) {
        paramCount++;
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `p.is_active = $${paramCount}`;
        params.push(is_active === 'true');
      }

      const result = await query(`
        SELECT 
          p.product_id,
          p.name as product_name,
          p.description,
          p.image_url,
          p.is_active,
          c.category_id,
          c.name as category_name,
          json_agg(
            json_build_object(
              'variant_id', pv.variant_id,
              'variant_name', pv.variant_name,
              'ounces', pv.ounces,
              'sku', pv.sku,
              'image_url', pv.image_url,
              'is_active', pv.is_active
            )
          ) FILTER (WHERE pv.variant_id IS NOT NULL) as variants
        FROM naxos.product p
        LEFT JOIN naxos.product_category c ON p.category_id = c.category_id
        LEFT JOIN naxos.product_variant pv ON p.product_id = pv.product_id
        ${whereClause}
        GROUP BY p.product_id, c.category_id, c.name
        ORDER BY p.name ASC
      `, params);

      res.status(200).json({
        message: 'Productos obtenidos exitosamente',
        products: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo productos:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los productos'
      });
    }
  }

  // Obtener producto por ID
  static async getProductById(req, res) {
    try {
      const productId = parseInt(req.params.id);

      const result = await query(`
        SELECT 
          p.product_id,
          p.name as product_name,
          p.description,
          p.image_url,
          p.is_active,
          c.category_id,
          c.name as category_name,
          json_agg(
            json_build_object(
              'variant_id', pv.variant_id,
              'variant_name', pv.variant_name,
              'ounces', pv.ounces,
              'sku', pv.sku,
              'image_url', pv.image_url,
              'is_active', pv.is_active,
              'current_price', (
                SELECT vp.price 
                FROM naxos.variant_price vp 
                WHERE vp.variant_id = pv.variant_id 
                AND vp.valid_from <= now() 
                AND (vp.valid_to IS NULL OR vp.valid_to > now())
                ORDER BY vp.valid_from DESC 
                LIMIT 1
              )
            )
          ) FILTER (WHERE pv.variant_id IS NOT NULL) as variants
        FROM naxos.product p
        LEFT JOIN naxos.product_category c ON p.category_id = c.category_id
        LEFT JOIN naxos.product_variant pv ON p.product_id = pv.product_id
        WHERE p.product_id = $1
        GROUP BY p.product_id, c.category_id, c.name
      `, [productId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Producto no encontrado',
          message: 'El producto especificado no existe'
        });
      }

      res.status(200).json({
        message: 'Producto obtenido exitosamente',
        product: result.rows[0]
      });

    } catch (error) {
      console.error('Error obteniendo producto:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el producto'
      });
    }
  }

  // ==================== VARIANTES ====================
  
  // Crear variante de producto
  static async createVariant(req, res) {
    try {
      const { error, value } = variantSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { product_id, variant_name, ounces, sku, image_url, is_active } = value;

      const result = await query(
        'INSERT INTO naxos.product_variant (product_id, variant_name, ounces, sku, image_url, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [product_id, variant_name, ounces, sku, image_url, is_active]
      );

      res.status(201).json({
        message: 'Variante creada exitosamente',
        variant: result.rows[0]
      });

    } catch (error) {
      console.error('Error creando variante:', error);
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({
          error: 'Variante ya existe',
          message: 'Ya existe una variante con ese nombre para este producto'
        });
      }
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear la variante'
      });
    }
  }

  // Obtener variantes de un producto
  static async getProductVariants(req, res) {
    try {
      const productId = parseInt(req.params.productId);

      const result = await query(`
        SELECT 
          pv.*,
          p.name as product_name,
          json_agg(
            json_build_object(
              'price_id', vp.price_id,
              'price', vp.price,
              'valid_from', vp.valid_from,
              'valid_to', vp.valid_to
            )
          ) FILTER (WHERE vp.price_id IS NOT NULL) as prices
        FROM naxos.product_variant pv
        LEFT JOIN naxos.product p ON pv.product_id = p.product_id
        LEFT JOIN naxos.variant_price vp ON pv.variant_id = vp.variant_id
        WHERE pv.product_id = $1
        GROUP BY pv.variant_id, p.name
        ORDER BY pv.variant_name ASC
      `, [productId]);

      res.status(200).json({
        message: 'Variantes obtenidas exitosamente',
        variants: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo variantes:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las variantes'
      });
    }
  }

  // ==================== PRECIOS ====================
  
  // Crear precio para variante
  static async createPrice(req, res) {
    try {
      const { error, value } = priceSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { variant_id, price, valid_from, valid_to } = value;

      // Verificar que la variante existe
      const variantExists = await query(
        'SELECT variant_id FROM naxos.product_variant WHERE variant_id = $1',
        [variant_id]
      );

      if (variantExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      const result = await query(
        'INSERT INTO naxos.variant_price (variant_id, price, valid_from, valid_to) VALUES ($1, $2, $3, $4) RETURNING *',
        [variant_id, price, valid_from, valid_to]
      );

      res.status(201).json({
        message: 'Precio creado exitosamente',
        price: result.rows[0]
      });

    } catch (error) {
      console.error('Error creando precio:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear el precio'
      });
    }
  }

  // Obtener precio actual de una variante
  static async getCurrentPrice(req, res) {
    try {
      const variantId = parseInt(req.params.variantId);

      const result = await query(`
        SELECT 
          vp.price_id,
          vp.variant_id,
          vp.price,
          vp.valid_from,
          vp.valid_to,
          pv.variant_name,
          pv.product_id,
          p.name as product_name
        FROM naxos.variant_price vp
        JOIN naxos.product_variant pv ON vp.variant_id = pv.variant_id
        JOIN naxos.product p ON pv.product_id = p.product_id
        WHERE vp.variant_id = $1
          AND vp.valid_from <= now()
          AND (vp.valid_to IS NULL OR vp.valid_to > now())
        ORDER BY vp.valid_from DESC
        LIMIT 1
      `, [variantId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Precio no encontrado',
          message: 'No hay precio vigente para esta variante'
        });
      }

      res.status(200).json({
        message: 'Precio obtenido exitosamente',
        price: result.rows[0]
      });

    } catch (error) {
      console.error('Error obteniendo precio:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el precio'
      });
    }
  }

  // ==================== SABORES ====================
  
  // Crear sabor
  static async createFlavor(req, res) {
    try {
      const { error, value } = flavorSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { name } = value;

      const result = await query(
        'INSERT INTO naxos.flavor (name) VALUES ($1) RETURNING *',
        [name]
      );

      res.status(201).json({
        message: 'Sabor creado exitosamente',
        flavor: result.rows[0]
      });

    } catch (error) {
      console.error('Error creando sabor:', error);
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Sabor ya existe',
          message: 'Ya existe un sabor con ese nombre'
        });
      }
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear el sabor'
      });
    }
  }

  // Obtener todos los sabores
  static async getFlavors(req, res) {
    try {
      const result = await query(
        'SELECT * FROM naxos.flavor ORDER BY name ASC'
      );

      res.status(200).json({
        message: 'Sabores obtenidos exitosamente',
        flavors: result.rows
      });

    } catch (error) {
      console.error('Error obteniendo sabores:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los sabores'
      });
    }
  }

  // ==================== MENÚ PÚBLICO ====================

  // Obtener carta/menu público (sin autenticación requerida)
  static async getPublicMenu(req, res) {
    try {
      // 1. Productos activos (para tarjetas)
      const productsResult = await query(`
        SELECT
          p.product_id,
          pc.name AS categoria,
          p.name,
          p.description,
          p.image_url
        FROM naxos.product p
        LEFT JOIN naxos.product_category pc ON pc.category_id = p.category_id
        WHERE p.is_active = true
        ORDER BY pc.name NULLS LAST, p.name
      `);

      // 2. Variantes + precio (para mostrar dentro de cada producto)
      const variantsResult = await query(`
        SELECT
          pv.product_id,
          pv.variant_id,
          pv.variant_name,
          pv.ounces,
          COALESCE(pv.image_url, p.image_url) AS foto_url,
          vp.price AS precio_actual
        FROM naxos.product_variant pv
        JOIN naxos.product p ON p.product_id = pv.product_id
        JOIN LATERAL (
          SELECT price
          FROM naxos.variant_price
          WHERE variant_id = pv.variant_id
            AND valid_from <= now()
            AND (valid_to IS NULL OR valid_to > now())
          ORDER BY valid_from DESC
          LIMIT 1
        ) vp ON true
        WHERE p.is_active = true
          AND pv.is_active = true
        ORDER BY pv.product_id, pv.ounces NULLS LAST, pv.variant_name
      `);

      // 3. Sabores activos por producto (para chips/tags)
      const flavorsResult = await query(`
        SELECT
          pf.product_id,
          json_agg(f.name ORDER BY f.name) AS sabores_activos
        FROM naxos.product_flavor pf
        JOIN naxos.flavor f ON f.flavor_id = pf.flavor_id
        WHERE pf.is_active = true
        GROUP BY pf.product_id
      `);

      res.status(200).json({
        message: 'Carta obtenida exitosamente',
        menu: {
          productos: productsResult.rows,
          variantes: variantsResult.rows,
          sabores: flavorsResult.rows
        }
      });

    } catch (error) {
      console.error('Error obteniendo carta:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la carta'
      });
    }
  }
}

module.exports = ProductsController;
