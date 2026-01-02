const { Product, Flavor, ProductFlavor } = require('../models');

// ==================== PRODUCT_FLAVORS CONTROLLER ====================

/**
 * Obtener todas las asociaciones de productos con sabores
 * GET /api/product-flavors
 */
const getAllProductFlavors = async (req, res) => {
  try {
    console.log('🔍 Obteniendo todas las asociaciones producto-sabor...');
    
    const associations = await ProductFlavor.findAll({
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
      ],
      order: [
        [{ model: Product, as: 'product' }, 'name', 'ASC'],
        [{ model: Flavor, as: 'flavor' }, 'name', 'ASC']
      ]
    });

    console.log(`✅ Encontradas ${associations.length} asociaciones`);
    
    res.json({
      success: true,
      message: 'Asociaciones obtenidas exitosamente',
      data: associations
    });
  } catch (error) {
    console.error('❌ Error obteniendo asociaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las asociaciones producto-sabor'
    });
  }
};

/**
 * Obtener sabores de un producto específico
 * GET /api/product-flavors/products/:productId/flavors
 */
const getProductFlavors = async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🔍 Obteniendo sabores para producto ${productId}...`);

    // Verificar que el producto existe
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Obtener sabores asociados al producto
    const productFlavors = await ProductFlavor.findAll({
      where: { 
        product_id: productId
      },
      include: [{
        model: Flavor,
        as: 'flavor',
        attributes: ['flavor_id', 'name']
      }],
      order: [[{ model: Flavor, as: 'flavor' }, 'name', 'ASC']]
    });

    const flavors = productFlavors.map(pf => pf.flavor);

    console.log(`✅ Producto ${productId} tiene ${flavors.length} sabores asociados`);
    
    res.json({
      success: true,
      message: 'Sabores del producto obtenidos exitosamente',
      flavors: flavors
    });
  } catch (error) {
    console.error('❌ Error obteniendo sabores del producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener sabores del producto'
    });
  }
};

/**
 * Obtener productos de un sabor específico
 * GET /api/product-flavors/flavors/:flavorId/products
 */
const getFlavorProducts = async (req, res) => {
  try {
    const { flavorId } = req.params;
    console.log(`🔍 Obteniendo productos para sabor ${flavorId}...`);

    // Verificar que el sabor existe
    const flavor = await Flavor.findByPk(flavorId);
    if (!flavor) {
      return res.status(404).json({
        success: false,
        message: 'Sabor no encontrado'
      });
    }

    // Obtener productos asociados al sabor
    const flavorProducts = await ProductFlavor.findAll({
      where: { 
        flavor_id: flavorId
      },
      include: [{
        model: Product,
        as: 'product',
        attributes: ['product_id', 'name']
      }],
      order: [[{ model: Product, as: 'product' }, 'name', 'ASC']]
    });

    const products = flavorProducts.map(fp => fp.product);

    console.log(`✅ Sabor ${flavorId} está asociado a ${products.length} productos`);
    
    res.json({
      success: true,
      message: 'Productos del sabor obtenidos exitosamente',
      products: products
    });
  } catch (error) {
    console.error('❌ Error obteniendo productos del sabor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos del sabor'
    });
  }
};

/**
 * Crear nueva asociación producto-sabor
 * POST /api/product-flavors
 */
const createProductFlavor = async (req, res) => {
  try {
    const { product_id, flavor_id, is_active = true } = req.body;
    console.log('🔍 Creando nueva asociación producto-sabor...', { product_id, flavor_id, is_active });

    // Validaciones
    if (!product_id || !flavor_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id y flavor_id son requeridos'
      });
    }

    // Verificar que el producto existe
    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(400).json({
        success: false,
        message: 'El producto especificado no existe'
      });
    }

    // Verificar que el sabor existe
    const flavor = await Flavor.findByPk(flavor_id);
    if (!flavor) {
      return res.status(400).json({
        success: false,
        message: 'El sabor especificado no existe'
      });
    }

    // Verificar que la asociación no existe ya
    const existingAssociation = await ProductFlavor.findOne({
      where: {
        product_id,
        flavor_id
      }
    });

    if (existingAssociation) {
      return res.status(400).json({
        success: false,
        message: 'Esta asociación ya existe'
      });
    }

    // Crear la asociación
    const newAssociation = await ProductFlavor.create({
      product_id,
      flavor_id,
      is_active
    });

    // Obtener la asociación con los datos relacionados
    const associationWithData = await ProductFlavor.findByPk(newAssociation.product_flavor_id, {
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

    console.log(`✅ Asociación creada: ${product.name} + ${flavor.name}`);
    
    res.status(201).json({
      success: true,
      message: 'Asociación creada exitosamente',
      data: associationWithData
    });
  } catch (error) {
    console.error('❌ Error creando asociación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la asociación'
    });
  }
};

/**
 * Actualizar estado de asociación producto-sabor
 * PUT /api/product-flavors/:id
 */
const updateProductFlavor = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    console.log(`🔍 Actualizando asociación ${id}...`, { is_active });

    // Verificar que la asociación existe
    const association = await ProductFlavor.findByPk(id, {
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
        message: 'Asociación no encontrada'
      });
    }

    // Actualizar estado
    await association.update({ is_active });

    console.log(`✅ Asociación actualizada: ${association.product.name} + ${association.flavor.name} -> ${is_active ? 'Activa' : 'Inactiva'}`);
    
    res.json({
      success: true,
      message: 'Asociación actualizada exitosamente',
      data: association
    });
  } catch (error) {
    console.error('❌ Error actualizando asociación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la asociación'
    });
  }
};

/**
 * Eliminar asociación producto-sabor
 * DELETE /api/product-flavors/:id
 */
const deleteProductFlavor = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Eliminando asociación ${id}...`);

    // Verificar que la asociación existe
    const association = await ProductFlavor.findByPk(id, {
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
        message: 'Asociación no encontrada'
      });
    }

    // Eliminar la asociación
    await association.destroy();

    console.log(`✅ Asociación eliminada: ${association.product.name} + ${association.flavor.name}`);
    
    res.json({
      success: true,
      message: 'Asociación eliminada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error eliminando asociación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la asociación'
    });
  }
};

/**
 * Eliminar todas las asociaciones de un producto
 * DELETE /api/product-flavors/products/:productId
 */
const deleteProductFlavors = async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🔍 Eliminando todas las asociaciones del producto ${productId}...`);

    // Verificar que el producto existe
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Eliminar todas las asociaciones
    const deletedCount = await ProductFlavor.destroy({
      where: { product_id: productId }
    });

    console.log(`✅ Eliminadas ${deletedCount} asociaciones del producto ${product.name}`);
    
    res.json({
      success: true,
      message: 'Asociaciones del producto eliminadas exitosamente',
      deletedCount
    });
  } catch (error) {
    console.error('❌ Error eliminando asociaciones del producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar las asociaciones del producto'
    });
  }
};

/**
 * Eliminar todas las asociaciones de un sabor
 * DELETE /api/product-flavors/flavors/:flavorId
 */
const deleteFlavorProducts = async (req, res) => {
  try {
    const { flavorId } = req.params;
    console.log(`🔍 Eliminando todas las asociaciones del sabor ${flavorId}...`);

    // Verificar que el sabor existe
    const flavor = await Flavor.findByPk(flavorId);
    if (!flavor) {
      return res.status(404).json({
        success: false,
        message: 'Sabor no encontrado'
      });
    }

    // Eliminar todas las asociaciones
    const deletedCount = await ProductFlavor.destroy({
      where: { flavor_id: flavorId }
    });

    console.log(`✅ Eliminadas ${deletedCount} asociaciones del sabor ${flavor.name}`);
    
    res.json({
      success: true,
      message: 'Asociaciones del sabor eliminadas exitosamente',
      deletedCount
    });
  } catch (error) {
    console.error('❌ Error eliminando asociaciones del sabor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar las asociaciones del sabor'
    });
  }
};

module.exports = {
  getAllProductFlavors,
  getProductFlavors,
  getFlavorProducts,
  createProductFlavor,
  updateProductFlavor,
  deleteProductFlavor,
  deleteProductFlavors,
  deleteFlavorProducts
};
