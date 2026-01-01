const Joi = require('joi');
const { Price, Variant } = require('../models');

// Esquema de validación para precios
const priceSchema = Joi.object({
  variant_id: Joi.number().integer().positive().required(),
  price: Joi.number().precision(2).positive().required(),
  valid_from: Joi.date().default('now'),
  valid_to: Joi.date().optional()
});

class PricesController {
  
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
      const variant = await Variant.findByPk(variant_id);
      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      const newPrice = await Price.create({
        variant_id,
        price,
        valid_from,
        valid_to
      });

      res.status(201).json({
        message: 'Precio creado exitosamente',
        price: newPrice
      });

    } catch (error) {
      console.error('Error creando precio:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear el precio'
      });
    }
  }

  // Obtener todos los precios
  static async getPrices(req, res) {
    try {
      const { variant_id } = req.query;
      
      const whereClause = {};
      if (variant_id) whereClause.variant_id = parseInt(variant_id);

      const prices = await Price.findAll({
        where: whereClause,
        include: [{
          model: Variant,
          as: 'variant',
          attributes: ['variant_id', 'variant_name', 'product_id'],
          include: [{
            model: require('../models').Product,
            as: 'product',
            attributes: ['product_id', 'name']
          }]
        }],
        order: [['valid_from', 'DESC']]
      });

      res.status(200).json({
        message: 'Precios obtenidos exitosamente',
        prices: prices
      });

    } catch (error) {
      console.error('Error obteniendo precios:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los precios'
      });
    }
  }

  // Obtener precio por ID
  static async getPriceById(req, res) {
    try {
      const priceId = parseInt(req.params.id);

      const price = await Price.findByPk(priceId, {
        include: [{
          model: Variant,
          as: 'variant',
          attributes: ['variant_id', 'variant_name', 'product_id'],
          include: [{
            model: require('../models').Product,
            as: 'product',
            attributes: ['product_id', 'name']
          }]
        }]
      });

      if (!price) {
        return res.status(404).json({
          error: 'Precio no encontrado',
          message: 'El precio especificado no existe'
        });
      }

      res.status(200).json({
        message: 'Precio obtenido exitosamente',
        price: price
      });

    } catch (error) {
      console.error('Error obteniendo precio:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el precio'
      });
    }
  }

  // Obtener precio actual de una variante
  static async getCurrentPrice(req, res) {
    try {
      const variantId = parseInt(req.params.variantId);

      // Verificar que la variante existe
      const variant = await Variant.findByPk(variantId);
      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      const currentPrice = await Price.findOne({
        where: {
          variant_id: variantId
        },
        include: [{
          model: Variant,
          as: 'variant',
          attributes: ['variant_id', 'variant_name', 'product_id'],
          include: [{
            model: require('../models').Product,
            as: 'product',
            attributes: ['product_id', 'name']
          }]
        }],
        order: [['valid_from', 'DESC']]
      });

      if (!currentPrice) {
        return res.status(404).json({
          error: 'Precio no encontrado',
          message: 'No hay precio vigente para esta variante'
        });
      }

      res.status(200).json({
        message: 'Precio actual obtenido exitosamente',
        price: currentPrice
      });

    } catch (error) {
      console.error('Error obteniendo precio actual:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el precio actual'
      });
    }
  }

  // Obtener precios de una variante
  static async getVariantPrices(req, res) {
    try {
      const variantId = parseInt(req.params.variantId);

      // Verificar que la variante existe
      const variant = await Variant.findByPk(variantId);
      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      const prices = await Price.findAll({
        where: { variant_id: variantId },
        include: [{
          model: Variant,
          as: 'variant',
          attributes: ['variant_id', 'variant_name', 'product_id'],
          include: [{
            model: require('../models').Product,
            as: 'product',
            attributes: ['product_id', 'name']
          }]
        }],
        order: [['valid_from', 'DESC']]
      });

      res.status(200).json({
        message: 'Precios de la variante obtenidos exitosamente',
        variant: variant,
        prices: prices
      });

    } catch (error) {
      console.error('Error obteniendo precios de la variante:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los precios de la variante'
      });
    }
  }

  // Actualizar precio
  static async updatePrice(req, res) {
    try {
      const priceId = parseInt(req.params.id);
      const { error, value } = priceSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { variant_id, price, valid_from, valid_to } = value;

      // Verificar que el precio existe
      const priceRecord = await Price.findByPk(priceId);
      if (!priceRecord) {
        return res.status(404).json({
          error: 'Precio no encontrado',
          message: 'El precio especificado no existe'
        });
      }

      // Verificar que la variante existe
      const variant = await Variant.findByPk(variant_id);
      if (!variant) {
        return res.status(404).json({
          error: 'Variante no encontrada',
          message: 'La variante especificada no existe'
        });
      }

      const updatedPrice = await priceRecord.update({
        variant_id,
        price,
        valid_from,
        valid_to
      });

      res.status(200).json({
        message: 'Precio actualizado exitosamente',
        price: updatedPrice
      });

    } catch (error) {
      console.error('Error actualizando precio:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar el precio'
      });
    }
  }

  // Eliminar precio
  static async deletePrice(req, res) {
    try {
      const priceId = parseInt(req.params.id);

      // Verificar que el precio existe
      const price = await Price.findByPk(priceId);
      if (!price) {
        return res.status(404).json({
          error: 'Precio no encontrado',
          message: 'El precio especificado no existe'
        });
      }

      await price.destroy();

      res.status(200).json({
        message: 'Precio eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando precio:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar el precio'
      });
    }
  }
}

module.exports = PricesController;
