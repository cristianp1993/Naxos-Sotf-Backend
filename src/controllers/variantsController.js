const Joi = require('joi');
const { Variant, Product, Price } = require('../models');

// Esquema de validación para variantes
const variantSchema = Joi.object({
  product_id: Joi.number().integer().positive().required(),
  variant_name: Joi.string().min(1).max(100).required(),
  ounces: Joi.number().integer().positive().optional(),
  sku: Joi.string().max(50).optional(),
  image_url: Joi.string().uri().optional(),
  is_active: Joi.boolean().default(true)
});

class VariantsController {
  
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

      // Verificar que el producto existe
      const product = await Product.findByPk(product_id);
      if (!product) {
        return res.status(404).json({
          error: 'Producto no encontrado',
          message: 'El producto especificado no existe'
        });
      }

      const variant = await Variant.create({
        product_id,
        variant_name,
        ounces,
        sku,
        image_url,
        is_active
      });

      res.status(201).json({
        message: 'Variante creada exitosamente',
        variant: variant
      });

    } catch (error) {
      console.error('Error creando variante:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
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

  // Obtener todas las variantes
  static async getVariants(req, res) {
    try {
      const { product_id, is_active } = req.query;
      
      const whereClause = {};
      if (product_id) whereClause.product_id = parseInt(product_id);
      if (is_active !== undefined) whereClause.is_active = is_active === 'true';

      const variants = await Variant.findAll({
        where: whereClause,
        include: [{
          model: Product,
          as: 'product',
          attributes: ['product_id', 'name']
        }],
        order: [['variant_name', 'ASC']]
      });

      res.status(200).json({
        message: 'Variantes obtenidas exitosamente',
        variants: variants
      });

    } catch (error) {
      console.error('Error obteniendo variantes:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las variantes'
      });
    }
  }

  // Obtener variantes de un producto específico
  static async getProductVariants(req, res) {
    try {
      const productId = parseInt(req.params.productId);

      // Verificar que el producto existe
      const product = await Product.findByPk(productId);
      if (!product) {
        return res.status(404).json({
          error: 'Producto no encontrado',
          message: 'El producto especificado no existe'
        });
      }

      const variants = await Variant.findAll({
        where: { product_id: productId },
        include: [{
          model: Product,
          as: 'product',
          attributes: ['product_id', 'name']
        }],
        order: [['ounces', 'ASC'], ['variant_name', 'ASC']]
      });

      res.status(200).json({
        message: 'Variantes del producto obtenidas exitosamente',
        product: product,
        variants: variants
      });

    } catch (error) {
      console.error('Error obteniendo variantes del producto:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las variantes del producto'
      });
    }
  }

  // Obtener variante por ID
  static async getVariantById(req, res) {
    try {
      const variantId = parseInt(req.params.id);

      const variant = await Variant.findByPk(variantId, {
        include: [{
          model: Product,
          as: 'product',
          attributes: ['product_id', 'name']
        }]
      });

      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      res.status(200).json({
        message: 'Variante obtenida exitosamente',
        variant: variant
      });

    } catch (error) {
      console.error('Error obteniendo variante:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la variante'
      });
    }
  }

  // Actualizar variante
  static async updateVariant(req, res) {
    try {
      const variantId = parseInt(req.params.id);
      const { error, value } = variantSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { product_id, variant_name, ounces, sku, image_url, is_active } = value;

      // Verificar que la variante existe
      const variant = await Variant.findByPk(variantId);
      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      // Verificar que el producto existe
      const product = await Product.findByPk(product_id);
      if (!product) {
        return res.status(404).json({
          error: 'Producto no encontrado',
          message: 'El producto especificado no existe'
        });
      }

      const updatedVariant = await variant.update({
        product_id,
        variant_name,
        ounces,
        sku,
        image_url,
        is_active
      });

      res.status(200).json({
        message: 'Variante actualizada exitosamente',
        variant: updatedVariant
      });

    } catch (error) {
      console.error('Error actualizando variante:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          error: 'Variante ya existe',
          message: 'Ya existe una variante con ese nombre para este producto'
        });
      }
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar la variante'
      });
    }
  }

  // Eliminar variante
  static async deleteVariant(req, res) {
    try {
      const variantId = parseInt(req.params.id);

      // Verificar que la variante existe
      const variant = await Variant.findByPk(variantId);
      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      await variant.destroy();

      res.status(200).json({
        message: 'Variante eliminada exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando variante:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar la variante'
      });
    }
  }
}

module.exports = VariantsController;
