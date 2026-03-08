// src/routes/loyalty.js
const express = require('express');
const router = express.Router();
const LoyaltyController = require('../controllers/loyaltyController');
const { authenticateToken } = require('../middleware/auth');

// Rutas públicas
router.post('/register', LoyaltyController.register);
router.get('/check-points', LoyaltyController.checkPoints);
router.get('/rewards', LoyaltyController.getRewards);

// Rutas protegidas (requieren autenticación)
router.get('/search', authenticateToken, LoyaltyController.search);
router.post('/add-points', authenticateToken, LoyaltyController.addPoints);
router.post('/redeem', authenticateToken, LoyaltyController.redeem);

module.exports = router;
