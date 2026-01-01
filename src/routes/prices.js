const express = require('express');
const router = express.Router();
const PricesController = require('../controllers/pricesController');

// ==================== RUTAS DE PRECIOS ====================

// Crear precio
router.post('/', PricesController.createPrice);

// Obtener todos los precios
router.get('/', PricesController.getPrices);

// Obtener precio por ID
router.get('/:id', PricesController.getPriceById);

// Obtener precio actual de una variante
router.get('/current/:variantId', PricesController.getCurrentPrice);

// Obtener precios de una variante
router.get('/variant/:variantId', PricesController.getVariantPrices);

// Actualizar precio
router.put('/:id', PricesController.updatePrice);

// Eliminar precio
router.delete('/:id', PricesController.deletePrice);

module.exports = router;
