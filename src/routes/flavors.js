const express = require('express');
const router = express.Router();
const FlavorsController = require('../controllers/flavorsController');

// ==================== RUTAS DE SABORES ====================

// Crear sabor
router.post('/', FlavorsController.createFlavor);

// Obtener todos los sabores
router.get('/', FlavorsController.getFlavors);

// Buscar sabores por nombre
router.get('/search', FlavorsController.searchFlavors);

// Obtener sabor por ID
router.get('/:id', FlavorsController.getFlavorById);

// Actualizar sabor
router.put('/:id', FlavorsController.updateFlavor);

// Eliminar sabor
router.delete('/:id', FlavorsController.deleteFlavor);

module.exports = router;
