const Joi = require('joi');
const { Variant, Product } = require('../models');

const variantSchema = Joi.object({
  product_id: Joi.number().integer().positive().required(),
  variant_name: Joi.string().min(1).max(100).required(),
  ounces: Joi.number().integer().positive().allow(null).optional(),
  toppings: Joi.number().integer().min(0).default(0),
  sku: Joi.string().max(50).allow(null, '').optional(),
  image_url: Joi.string().uri().allow(null, '').optional(),
  price: Joi.number().precision(2).min(0).required(),
  is_active: Joi.boolean().default(true)
});

class VariantsController {
  static async createVariant(req, res) {
    try {
      const { error, value } = variantSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { product_id, variant_name, ounces, toppings, sku, image_url, price, is_active } = value;

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
        toppings,
        sku,
        image_url,
        price,
        is_active
      });

      return res.status(201).json({
        message: 'Variante creada exitosamente',
        variant
      });
    } catch (error) {
      console.error('Error creando variante:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          error: 'Variante ya existe',
          message: 'Ya existe una variante con ese nombre para este producto'
        });
      }
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear la variante'
      });
    }
  }

  static async getVariants(req, res) {
    try {
      const { product_id, is_active } = req.query;

      const whereClause = {};
      if (product_id) whereClause.product_id = parseInt(product_id, 10);
      if (is_active !== undefined) whereClause.is_active = is_active === 'true';

      const variants = await Variant.findAll({
        where: whereClause,
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['product_id', 'name']
          }
        ],
        order: [['variant_name', 'ASC']]
      });

      return res.status(200).json({
        message: 'Variantes obtenidas exitosamente',
        variants
      });
    } catch (error) {
      console.error('Error obteniendo variantes:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las variantes'
      });
    }
  }

  static async getProductVariants(req, res) {
    try {
      const productId = parseInt(req.params.productId, 10);

      const product = await Product.findByPk(productId);
      if (!product) {
        return res.status(404).json({
          error: 'Producto no encontrado',
          message: 'El producto especificado no existe'
        });
      }

      const variants = await Variant.findAll({
        where: { product_id: productId },
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['product_id', 'name']
          }
        ],
        order: [['ounces', 'ASC'], ['variant_name', 'ASC']]
      });

      return res.status(200).json({
        message: 'Variantes del producto obtenidas exitosamente',
        product,
        variants
      });
    } catch (error) {
      console.error('Error obteniendo variantes del producto:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las variantes del producto'
      });
    }
  }

  static async getVariantById(req, res) {
    try {
      const variantId = parseInt(req.params.id, 10);

      const variant = await Variant.findByPk(variantId, {
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['product_id', 'name']
          }
        ]
      });

      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      return res.status(200).json({
        message: 'Variante obtenida exitosamente',
        variant
      });
    } catch (error) {
      console.error('Error obteniendo variante:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la variante'
      });
    }
  }

  static async updateVariant(req, res) {
    try {
      const variantId = parseInt(req.params.id, 10);
      const { error, value } = variantSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { product_id, variant_name, ounces, toppings, sku, image_url, price, is_active } = value;

      const variant = await Variant.findByPk(variantId);
      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

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
        toppings,
        sku,
        image_url,
        price,
        is_active
      });

      return res.status(200).json({
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
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar la variante'
      });
    }
  }

  static async deleteVariant(req, res) {
    try {
      const variantId = parseInt(req.params.id, 10);

      const variant = await Variant.findByPk(variantId);
      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      await variant.destroy();

      return res.status(200).json({
        message: 'Variante eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error eliminando variante:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar la variante'
      });
    }
  }
}

module.exports = VariantsController;
