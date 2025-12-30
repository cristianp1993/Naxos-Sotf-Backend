const express = require('express');
const router = express.Router();
const ProductsController = require('../controllers/productsController');
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Categorías
router.get('/categories', ProductsController.getCategories);
router.post('/categories', requireManagerOrAdmin, ProductsController.createCategory);

// Productos
router.get('/', ProductsController.getProducts);
router.post('/', requireManagerOrAdmin, ProductsController.createProduct);
router.get('/:id', ProductsController.getProductById);

// Variantes
router.post('/variants', requireManagerOrAdmin, ProductsController.createVariant);
router.get('/:productId/variants', ProductsController.getProductVariants);

// Precios
router.post('/prices', requireManagerOrAdmin, ProductsController.createPrice);
router.get('/prices/:variantId/current', ProductsController.getCurrentPrice);

// Sabores
router.get('/flavors', ProductsController.getFlavors);
router.post('/flavors', requireManagerOrAdmin, ProductsController.createFlavor);

module.exports = router;
