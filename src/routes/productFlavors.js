const express = require('express');
const router = express.Router();
const {
  getProductFlavors,
  associateFlavorsToProduct,
  removeFlavorFromProduct
} = require('../controllers/productsController');

// ==================== RUTAS DE PRODUCT_FLAVORS ====================

// Obtener sabores de un producto
router.get('/products/:productId/flavors', getProductFlavors);

// Asociar sabores a un producto
router.post('/products/:productId/flavors', associateFlavorsToProduct);

// Remover sabor de un producto
router.delete('/products/:productId/flavors/:flavorId', removeFlavorFromProduct);

module.exports = router;
