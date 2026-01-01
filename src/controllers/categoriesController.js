const Joi = require('joi');
const { Category } = require('../models');

// Esquema de validación
const categorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required()
});

class CategoriesController {
  
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

      const category = await Category.create({ name });

      res.status(201).json({
        message: 'Categoría creada exitosamente',
        category: category
      });

    } catch (error) {
      console.error('Error creando categoría:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
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
      const categories = await Category.findAll({
        order: [['name', 'ASC']]
      });

      res.status(200).json({
        message: 'Categorías obtenidas exitosamente',
        categories: categories
      });

    } catch (error) {
      console.error('Error obteniendo categorías:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las categorías'
      });
    }
  }

  // Obtener categoría por ID
  static async getCategoryById(req, res) {
    try {
      const categoryId = parseInt(req.params.id);

      const category = await Category.findByPk(categoryId);

      if (!category) {
        return res.status(404).json({
          error: 'Categoría no encontrada',
          message: 'La categoría especificada no existe'
        });
      }

      res.status(200).json({
        message: 'Categoría obtenida exitosamente',
        category: category
      });

    } catch (error) {
      console.error('Error obteniendo categoría:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la categoría'
      });
    }
  }

  // Actualizar categoría
  static async updateCategory(req, res) {
    try {
      const categoryId = parseInt(req.params.id);
      const { error, value } = categorySchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          message: error.details[0].message
        });
      }

      const { name } = value;

      // Verificar que la categoría existe
      const category = await Category.findByPk(categoryId);

      if (!category) {
        return res.status(404).json({
          error: 'Categoría no encontrada',
          message: 'La categoría especificada no existe'
        });
      }

      const updatedCategory = await category.update({ name });

      res.status(200).json({
        message: 'Categoría actualizada exitosamente',
        category: updatedCategory
      });

    } catch (error) {
      console.error('Error actualizando categoría:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          error: 'Categoría ya existe',
          message: 'Ya existe una categoría con ese nombre'
        });
      }
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar la categoría'
      });
    }
  }

  // Eliminar categoría
  static async deleteCategory(req, res) {
    try {
      const categoryId = parseInt(req.params.id);

      // Verificar que la categoría existe
      const category = await Category.findByPk(categoryId);

      if (!category) {
        return res.status(404).json({
          error: 'Categoría no encontrada',
          message: 'La categoría especificada no existe'
        });
      }

      await category.destroy();

      res.status(200).json({
        message: 'Categoría eliminada exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando categoría:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar la categoría'
      });
    }
  }
}

module.exports = CategoriesController;
