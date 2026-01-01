const express = require('express');
const router = express.Router();
const CategoriesController = require('../controllers/categoriesController');

// ==================== RUTAS DE CATEGORÍAS ====================

// Crear categoría
router.post('/', CategoriesController.createCategory);

// Obtener todas las categorías
router.get('/', CategoriesController.getCategories);

// Obtener categoría por ID
router.get('/:id', CategoriesController.getCategoryById);

// Actualizar categoría
router.put('/:id', CategoriesController.updateCategory);

// Eliminar categoría
router.delete('/:id', CategoriesController.deleteCategory);

module.exports = router;
