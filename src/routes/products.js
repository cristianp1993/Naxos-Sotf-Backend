const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories
} = require('../controllers/productsController');

// Rutas públicas para obtener datos (sin autenticación)
router.get('/categories', getCategories);

// Rutas protegidas (requieren autenticación)
router.use(authenticateToken);

// Obtener todos los productos
router.get('/', getAllProducts);

// Obtener producto por ID
router.get('/:id', getProductById);

// Crear nuevo producto
router.post('/', createProduct);

// Actualizar producto
router.put('/:id', updateProduct);

// Eliminar producto
router.delete('/:id', deleteProduct);

module.exports = router;
