const express = require('express');
const router = express.Router();
const ReportsController = require('../controllers/reportsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Dashboard general
router.get('/dashboard', ReportsController.getDashboard);

// Reportes de ventas
router.get('/sales', requireAdmin, ReportsController.getSalesReport);

// Reportes de inventario
router.get('/inventory/movements', requireAdmin, ReportsController.getInventoryMovementsReport);
router.get('/stock', ReportsController.getStockReport);

// Reportes de turnos
router.get('/shifts', requireAdmin, ReportsController.getShiftsReport);

// Reportes de productos
router.get('/products', requireAdmin, ReportsController.getProductsReport);

module.exports = router;
