const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventoryController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Ubicaciones
router.get('/locations', InventoryController.getLocations);
router.post('/locations', requireAdmin, InventoryController.createLocation);

// Stock
router.get('/locations/:locationId/stock', InventoryController.getStockByLocation);
router.get('/variants/:variantId/stock', InventoryController.getStockByVariant);
router.put('/stock', requireAdmin, InventoryController.updateStock);

// Movimientos
router.post('/movements', requireAdmin, InventoryController.createMovement);
router.get('/movements/history', InventoryController.getMovementHistory);

// Reportes
router.get('/reports/low-stock', InventoryController.getLowStock);
router.get('/reports/summary', InventoryController.getInventorySummary);

module.exports = router;
