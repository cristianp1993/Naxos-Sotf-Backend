const express = require('express');
const router = express.Router();
const ReportsController = require('../controllers/reportsController');
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Dashboard general
router.get('/dashboard', ReportsController.getDashboard);

// Reportes de ventas
router.get('/sales', requireManagerOrAdmin, ReportsController.getSalesReport);

// Reportes de inventario
router.get('/inventory/movements', requireManagerOrAdmin, ReportsController.getInventoryMovementsReport);
router.get('/stock', ReportsController.getStockReport);

// Reportes de turnos
router.get('/shifts', requireManagerOrAdmin, ReportsController.getShiftsReport);

// Reportes de productos
router.get('/products', requireManagerOrAdmin, ReportsController.getProductsReport);

module.exports = router;
