const Joi = require('joi');
const { Flavor } = require('../models');

// Esquema de validación para sabores
const flavorSchema = Joi.object({
  name: Joi.string().min(2).max(100).required()
});

class FlavorsController {
  
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

      const flavor = await Flavor.create({ name });

      res.status(201).json({
        message: 'Sabor creado exitosamente',
        flavor: flavor
      });

    } catch (error) {
      console.error('Error creando sabor:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
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
      const flavors = await Flavor.findAll({
        order: [['name', 'ASC']]
      });

      res.status(200).json({
        message: 'Sabores obtenidos exitosamente',
        flavors: flavors
      });

    } catch (error) {
      console.error('Error obteniendo sabores:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los sabores'
      });
    }
  }

  // Obtener sabor por ID
  static async getFlavorById(req, res) {
    try {
      const flavorId = parseInt(req.params.id);

      const flavor = await Flavor.findByPk(flavorId);

      if (!flavor) {
        return res.status(404).json({
          error: 'Sabor no encontrado',
          message: 'El sabor especificado no existe'
        });
      }

      res.status(200).json({
        message: 'Sabor obtenido exitosamente',
        flavor: flavor
      });

    } catch (error) {
      console.error('Error obteniendo sabor:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el sabor'
      });
    }
  }

  // Actualizar sabor
  static async updateFlavor(req, res) {
    try {
      const flavorId = parseInt(req.params.id);
      const { error, value } = flavorSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { name } = value;

      // Verificar que el sabor existe
      const flavor = await Flavor.findByPk(flavorId);

      if (!flavor) {
        return res.status(404).json({
          error: 'Sabor no encontrado',
          message: 'El sabor especificado no existe'
        });
      }

      const updatedFlavor = await flavor.update({ name });

      res.status(200).json({
        message: 'Sabor actualizado exitosamente',
        flavor: updatedFlavor
      });

    } catch (error) {
      console.error('Error actualizando sabor:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          error: 'Sabor ya existe',
          message: 'Ya existe un sabor con ese nombre'
        });
      }
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar el sabor'
      });
    }
  }

  // Eliminar sabor
  static async deleteFlavor(req, res) {
    try {
      const flavorId = parseInt(req.params.id);

      // Verificar que el sabor existe
      const flavor = await Flavor.findByPk(flavorId);

      if (!flavor) {
        return res.status(404).json({
          error: 'Sabor no encontrado',
          message: 'El sabor especificado no existe'
        });
      }

      await flavor.destroy();

      res.status(200).json({
        message: 'Sabor eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando sabor:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar el sabor'
      });
    }
  }

  // Buscar sabores por nombre
  static async searchFlavors(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.trim() === '') {
        return res.status(400).json({
          error: 'Parámetro de búsqueda requerido',
          message: 'Se requiere el parámetro "q" para la búsqueda'
        });
      }

      const flavors = await Flavor.findAll({
        where: {
          name: {
            [require('sequelize').Op.iLike]: `%${q}%`
          }
        },
        order: [['name', 'ASC']]
      });

      res.status(200).json({
        message: 'Búsqueda de sabores exitosa',
        query: q,
        flavors: flavors
      });

    } catch (error) {
      console.error('Error buscando sabores:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron buscar los sabores'
      });
    }
  }
}

module.exports = FlavorsController;
