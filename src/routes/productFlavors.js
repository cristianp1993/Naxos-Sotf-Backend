const express = require('express');
const router = express.Router();
const {
  getAllProductFlavors,
  getProductFlavors,
  getFlavorProducts,
  createProductFlavor,
  updateProductFlavor,
  deleteProductFlavor,
  deleteProductFlavors,
  deleteFlavorProducts
} = require('../controllers/productFlavorsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ==================== RUTAS DE PRODUCT_FLAVORS ====================

// Todas las rutas requieren autenticación de admin
router.use(authenticateToken, requireAdmin);

// Rutas CRUD completas
// Obtener todas las asociaciones
router.get('/', getAllProductFlavors);

// Crear nueva asociación
router.post('/', createProductFlavor);

// Obtener sabores de un producto específico
router.get('/products/:productId/flavors', getProductFlavors);

// Obtener productos de un sabor específico
router.get('/flavors/:flavorId/products', getFlavorProducts);

// Actualizar asociación por ID
router.put('/:id', updateProductFlavor);

// Eliminar asociación por ID
router.delete('/:id', deleteProductFlavor);

// Eliminar todas las asociaciones de un producto
router.delete('/products/:productId', deleteProductFlavors);

// Eliminar todas las asociaciones de un sabor
router.delete('/flavors/:flavorId', deleteFlavorProducts);

// Rutas para compatibilidad con frontend existente
// Asociar sabores a un producto (reemplaza el POST individual)
router.post('/products/:productId/flavors', async (req, res) => {
  try {
    const { productId } = req.params;
    const { flavor_ids } = req.body;

    if (!Array.isArray(flavor_ids)) {
      return res.status(400).json({
        success: false,
        message: 'flavor_ids debe ser un array'
      });
    }

    // Crear asociaciones para cada sabor
    const associations = [];
    for (const flavor_id of flavor_ids) {
      try {
        const association = await createProductFlavor({
          body: { product_id: productId, flavor_id, is_active: true },
          params: {},
          res
        });
        if (association) {
          associations.push(association);
        }
      } catch (error) {
        console.log(`Error creando asociación para flavor_id ${flavor_id}:`, error);
      }
    }

    res.json({
      success: true,
      message: 'Sabores asociados exitosamente',
      data: associations
    });
  } catch (error) {
    console.error('Error en associateFlavorsToProduct:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asociar sabores al producto'
    });
  }
});

// Remover sabor de un producto
router.delete('/products/:productId/flavors/:flavorId', async (req, res) => {
  try {
    const { productId, flavorId } = req.params;

    // Buscar la asociación existente
    const { ProductFlavor, Product, Flavor } = require('../models');
    const association = await ProductFlavor.findOne({
      where: {
        product_id: productId,
        flavor_id: flavorId
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['product_id', 'name']
        },
        {
          model: Flavor,
          as: 'flavor',
          attributes: ['flavor_id', 'name']
        }
      ]
    });

    if (!association) {
      return res.status(404).json({
        success: false,
        message: 'Asociación sabor-producto no encontrada'
      });
    }

    // Eliminar la asociación
    await association.destroy();

    res.json({
      success: true,
      message: 'Sabor removido del producto exitosamente'
    });
  } catch (error) {
    console.error('Error en removeFlavorFromProduct:', error);
    res.status(500).json({
      success: false,
      message: 'Error al remover sabor del producto'
    });
  }
});

module.exports = router;
