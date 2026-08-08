const { Product, Category, Flavor, ProductFlavor } = require('../models');

// ==================== PRODUCTOS ====================

// Obtener todos los productos con información de categoría
const getAllProducts = async (req, res) => {
  try {
    //console.log('🔍 Ejecutando getAllProducts...');
    const products = await Product.findAll({
      include: [{
        model: Category,
        as: 'category',
        attributes: ['category_id', 'name']
      }],
      order: [['product_id', 'ASC']]
    });
    //console.log('📦 Productos encontrados:', products.length);
    //console.log('📦 Productos data:', JSON.stringify(products, null, 2));
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('❌ Error al obtener productos:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Error al obtener productos' });
  }
};

// Obtener producto por ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['category_id', 'name']
      }]
    });
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ success: false, message: 'Error al obtener producto' });
  }
};

// Crear nuevo producto
const createProduct = async (req, res) => {
  try {
    const { category_id, name, description, image_url } = req.body;
    
    // Validaciones
    if (!category_id || !name) {
      return res.status(400).json({ 
        success: false, 
        message: 'La categoría y el nombre son obligatorios' 
      });
    }
    
    // Verificar que la categoría existe
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(400).json({ 
        success: false, 
        message: 'La categoría especificada no existe' 
      });
    }
    
    const newProduct = await Product.create({
      category_id,
      name,
      description: description || null,
      image_url: image_url || null,
      is_active: true
    });
    
    // Obtener el producto con la información de la categoría
    const productWithCategory = await Product.findByPk(newProduct.product_id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['category_id', 'name']
      }]
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Producto creado exitosamente', 
      data: productWithCategory 
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Error de validación', 
        errors: error.errors.map(e => e.message) 
      });
    }
    res.status(500).json({ success: false, message: 'Error al crear producto' });
  }
};

// Actualizar producto
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, description, image_url, is_active } = req.body;
    
    // Verificar que el producto existe
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    
    // Validaciones
    if (!category_id || !name) {
      return res.status(400).json({ 
        success: false, 
        message: 'La categoría y el nombre son obligatorios' 
      });
    }
    
    // Verificar que la categoría existe
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(400).json({ 
        success: false, 
        message: 'La categoría especificada no existe' 
      });
    }
    
    // Actualizar producto
    await product.update({
      category_id,
      name,
      description: description || null,
      image_url: image_url || null,
      is_active: is_active !== undefined ? is_active : product.is_active
    });
    
    // Obtener el producto actualizado con la información de la categoría
    const updatedProduct = await Product.findByPk(id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['category_id', 'name']
      }]
    });
    
    res.json({ 
      success: true, 
      message: 'Producto actualizado exitosamente', 
      data: updatedProduct 
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Error de validación', 
        errors: error.errors.map(e => e.message) 
      });
    }
    res.status(500).json({ success: false, message: 'Error al actualizar producto' });
  }
};

// Eliminar producto
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el producto existe
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    
    await product.destroy();
    
    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar producto' });
  }
};

// Obtener categorías para el selector
const getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('❌ Error al obtener categorías:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Error al obtener categorías' });
  }
};

// ==================== PRODUCT_FLAVORS ====================

// Obtener sabores de un producto
const getProductFlavors = async (req, res) => {
  try {
    const { productId } = req.params;

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
        product_id: productId,
        is_active: true 
      },
      include: [{
        model: Flavor,
        as: 'flavor',
        attributes: ['flavor_id', 'name']
      }],
      order: [[{ model: Flavor, as: 'flavor' }, 'name', 'ASC']]
    });

    const flavors = productFlavors.map(pf => pf.flavor);

    res.status(200).json({
      success: true,
      message: 'Sabores del producto obtenidos exitosamente',
      flavors: flavors
    });

  } catch (error) {
    console.error('Error obteniendo sabores del producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener sabores del producto'
    });
  }
};

// Asociar sabores a un producto
const associateFlavorsToProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { flavor_ids } = req.body;

    // Validar que flavor_ids sea un array
    if (!Array.isArray(flavor_ids)) {
      return res.status(400).json({
        success: false,
        message: 'flavor_ids debe ser un array'
      });
    }

    // Verificar que el producto existe
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Verificar que todos los sabores existen
    const flavors = await Flavor.findAll({
      where: { flavor_id: flavor_ids }
    });

    if (flavors.length !== flavor_ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Algunos sabores no existen'
      });
    }

    // Eliminar asociaciones existentes
    await ProductFlavor.destroy({
      where: { product_id: productId }
    });

    // Crear nuevas asociaciones
    const associations = flavor_ids.map(flavorId => ({
      product_id: productId,
      flavor_id: flavorId,
      is_active: true
    }));

    await ProductFlavor.bulkCreate(associations);

    res.status(200).json({
      success: true,
      message: 'Sabores asociados al producto exitosamente'
    });

  } catch (error) {
    console.error('Error asociando sabores al producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asociar sabores al producto'
    });
  }
};

// Remover sabor de un producto
const removeFlavorFromProduct = async (req, res) => {
  try {
    const { productId, flavorId } = req.params;

    // Verificar que la asociación existe
    const productFlavor = await ProductFlavor.findOne({
      where: {
        product_id: productId,
        flavor_id: flavorId
      }
    });

    if (!productFlavor) {
      return res.status(404).json({
        success: false,
        message: 'Asociación sabor-producto no encontrada'
      });
    }

    // Eliminar la asociación
    await productFlavor.destroy();

    res.status(200).json({
      success: true,
      message: 'Sabor removido del producto exitosamente'
    });

  } catch (error) {
    console.error('Error removiendo sabor del producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al remover sabor del producto'
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getProductFlavors,
  associateFlavorsToProduct,
  removeFlavorFromProduct
};
