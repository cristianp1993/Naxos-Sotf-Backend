const express = require('express');
const router = express.Router();
const VariantsController = require('../controllers/variantsController');

// ==================== RUTAS DE VARIANTES ====================

// Crear variante
router.post('/', VariantsController.createVariant);

// Obtener todas las variantes
router.get('/', VariantsController.getVariants);

// Obtener variantes de un producto específico
router.get('/product/:productId', VariantsController.getProductVariants);

// Obtener variante por ID
router.get('/:id', VariantsController.getVariantById);

// Actualizar variante
router.put('/:id', VariantsController.updateVariant);

// Eliminar variante
router.delete('/:id', VariantsController.deleteVariant);

module.exports = router;
