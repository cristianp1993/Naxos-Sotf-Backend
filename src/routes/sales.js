// src/routes/sales.js
const express = require('express');
const router = express.Router();
const SalesController = require('../controllers/salesController'); 
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

//router.get('/reports/daily-stats', SalesController.getDailySalesStats);
//router.get('/reports/top-products', SalesController.getTopSellingProducts);

router.post('/full', SalesController.createFullSale);
router.post('/', SalesController.createSale);
router.get('/', SalesController.getSales);
router.post('/:saleId/items', SalesController.addSaleItem);
router.put('/items/:itemId', SalesController.updateSaleItem);
router.delete('/items/:itemId', SalesController.removeSaleItem);
router.post('/:saleId/payments', SalesController.processPayment);
router.get('/:id', SalesController.getSaleById);
router.put('/:id', SalesController.updateSale);
router.delete('/:id', SalesController.deleteSale);
router.delete('/:id/cancel', SalesController.cancelSale);

module.exports = router;