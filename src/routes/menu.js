const express = require('express');
const router = express.Router();
const MenuController = require('../controllers/menuController');

// ==================== RUTAS DE MENÚ/CARTA ====================

// Obtener carta pública completa (sin autenticación requerida)
router.get('/public', MenuController.getPublicMenu);

// // Obtener carta simplificada (solo productos activos)
// router.get('/simple', MenuController.getSimpleMenu);

// // Obtener productos con variantes y precios
// router.get('/variants', MenuController.getProductsWithVariants);

// // Obtener sabores activos por producto
// router.get('/flavors', MenuController.getProductFlavors);

module.exports = router;
