const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Rutas públicas (no requieren autenticación)
router.post('/login', AuthController.login);

// Rutas que requieren autenticación
router.use(authenticateToken);

router.post('/register', requireAdmin, AuthController.register);
router.get('/profile', AuthController.getProfile);
router.put('/change-password', AuthController.changePassword);
router.get('/users', requireAdmin, AuthController.getUsers);

module.exports = router;
