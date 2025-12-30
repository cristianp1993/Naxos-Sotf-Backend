const express = require('express');
const router = express.Router();
const SalesController = require('../controllers/salesController');
const { authenticateToken } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Ventas
router.post('/', SalesController.createSale);
router.get('/', SalesController.getSales);
router.get('/:id', SalesController.getSaleById);
router.delete('/:id/cancel', SalesController.cancelSale);

// Items de venta
router.post('/:saleId/items', SalesController.addSaleItem);
router.put('/items/:itemId', SalesController.updateSaleItem);
router.delete('/items/:itemId', SalesController.removeSaleItem);

// Pagos
router.post('/:saleId/payments', SalesController.processPayment);

// Reportes
router.get('/reports/daily-stats', SalesController.getDailySalesStats);
router.get('/reports/top-products', SalesController.getTopSellingProducts);

module.exports = router;
