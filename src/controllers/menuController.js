const { Product, Category, Variant, Price, Flavor, ProductFlavor, sequelize } = require('../models');
const { Op } = require('sequelize');

class MenuController {
  
  // ==================== MENÚ PÚBLICO ====================

  // Obtener carta/menu público (sin autenticación requerida)
  static async getPublicMenu(req, res) {
    try {
      const t = await sequelize.transaction();
      
      try {
        // 1. Productos activos (para tarjetas)
        const products = await Product.findAll({
          where: { is_active: true },
          include: [{
            model: Category,
            as: 'category',
            attributes: ['name']
          }],
          attributes: ['product_id', 'name', 'description', 'image_url'],
          order: [
            [{ model: Category, as: 'category' }, 'name', 'ASC'],
            ['name', 'ASC']
          ],
          transaction: t
        });

        // 2. Variantes + precio actual (para mostrar dentro de cada producto)
        const variants = await Variant.findAll({
          where: { is_active: true },
          include: [
            {
              model: Product,
              as: 'product',
              where: { is_active: true },
              attributes: ['product_id', 'name', 'image_url'],
              required: true
            },
            {
              model: Price,
              as: 'prices',
              where: {
                valid_from: { [Op.lte]: new Date() },
                [Op.or]: [
                  { valid_to: null },
                  { valid_to: { [Op.gt]: new Date() } }
                ]
              },
              required: true,
              order: [['valid_from', 'DESC']],
              limit: 1
            }
          ],
          attributes: ['variant_id', 'variant_name', 'ounces', 'toppings', 'image_url'],
          order: [
            ['product_id', 'ASC'],
            ['ounces', 'ASC'],
            ['variant_name', 'ASC']
          ],
          transaction: t
        });

        // 3. Sabores activos por producto (para chips/tags)
        const productFlavors = await ProductFlavor.findAll({
          where: { is_active: true },
          include: [{
            model: Flavor,
            as: 'flavor',
            attributes: ['name']
          }],
          attributes: ['product_id'],
          transaction: t
        });

        // Procesar los datos para el formato requerido
        const formattedProducts = products.map(product => ({
          product_id: product.product_id,
          categoria: product.category ? product.category.name : null,
          name: product.name,
          description: product.description,
          image_url: product.image_url
        }));

        const formattedVariants = variants.map(variant => ({
          product_id: variant.product_id,
          variant_id: variant.variant_id,
          variant_name: variant.variant_name,
          ounces: variant.ounces,
          toppings: variant.toppings || 0,
          foto_url: variant.image_url || variant.product.image_url,
          precio_actual: variant.prices && variant.prices.length > 0 
            ? parseFloat(variant.prices[0].price) 
            : null
        }));

        // Agrupar sabores por producto
        const flavorsMap = new Map();
        productFlavors.forEach(pf => {
          const productId = pf.product_id;
          if (!flavorsMap.has(productId)) {
            flavorsMap.set(productId, []);
          }
          flavorsMap.get(productId).push(pf.flavor.name);
        });

        const formattedFlavors = Array.from(flavorsMap.entries()).map(([product_id, sabores]) => ({
          product_id: parseInt(product_id),
          sabores_activos: sabores.sort()
        }));

        await t.commit();

        res.status(200).json({
          message: 'Carta obtenida exitosamente',
          menu: {
            productos: formattedProducts,
            variantes: formattedVariants,
            sabores: formattedFlavors
          }
        });

      } catch (error) {
        await t.rollback();
        throw error;
      }

    } catch (error) {
      console.error('Error obteniendo carta:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la carta'
      });
    }
  }

  // Obtener carta simplificada (solo productos activos)
  static async getSimpleMenu(req, res) {
    try {
      const products = await Product.findAll({
        where: { is_active: true },
        include: [{
          model: Category,
          as: 'category',
          attributes: ['name']
        }],
        attributes: ['product_id', 'name', 'description', 'image_url'],
        order: [
          [{ model: Category, as: 'category' }, 'name', 'ASC'],
          ['name', 'ASC']
        ]
      });

      const formattedProducts = products.map(product => ({
        product_id: product.product_id,
        categoria: product.category ? product.category.name : null,
        name: product.name,
        description: product.description,
        image_url: product.image_url
      }));

      res.status(200).json({
        message: 'Menú simplificado obtenido exitosamente',
        menu: {
          productos: formattedProducts
        }
      });

    } catch (error) {
      console.error('Error obteniendo menú simplificado:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el menú simplificado'
      });
    }
  }

  // Obtener productos con variantes y precios
  static async getProductsWithVariants(req, res) {
    try {
      const { category_id } = req.query;

      const whereClause = { is_active: true };
      if (category_id) {
        whereClause.category_id = parseInt(category_id);
      }

      const variants = await Variant.findAll({
        where: { is_active: true },
        include: [
          {
            model: Product,
            as: 'product',
            where: whereClause,
            required: true,
            include: [{
              model: Category,
              as: 'category',
              attributes: ['name']
            }]
          },
          {
            model: Price,
            as: 'prices',
            where: {
              valid_from: { [Op.lte]: new Date() },
              [Op.or]: [
                { valid_to: null },
                { valid_to: { [Op.gt]: new Date() } }
              ]
            },
            required: true,
            order: [['valid_from', 'DESC']],
            limit: 1
          }
        ],
        attributes: ['variant_id', 'variant_name', 'ounces', 'toppings', 'image_url'],
        order: [
          [{ model: Product, as: 'product' }, 'name', 'ASC'],
          ['ounces', 'ASC'],
          ['variant_name', 'ASC']
        ]
      });

      const formattedVariants = variants.map(variant => ({
        product_id: variant.product_id,
        product_name: variant.product.name,
        categoria: variant.product.category ? variant.product.category.name : null,
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        ounces: variant.ounces,
        toppings: variant.toppings || 0,
        image_url: variant.image_url || variant.product.image_url,
        precio_actual: variant.prices && variant.prices.length > 0 
          ? parseFloat(variant.prices[0].price) 
          : null
      }));

      res.status(200).json({
        message: 'Productos con variantes obtenidos exitosamente',
        variants: formattedVariants
      });

    } catch (error) {
      console.error('Error obteniendo productos con variantes:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los productos con variantes'
      });
    }
  }

  // Obtener sabores activos por producto
  static async getProductFlavors(req, res) {
    try {
      const productFlavors = await ProductFlavor.findAll({
        where: { is_active: true },
        include: [
          {
            model: Product,
            as: 'product',
            where: { is_active: true },
            required: true,
            attributes: ['product_id', 'name']
          },
          {
            model: Flavor,
            as: 'flavor',
            required: true,
            attributes: ['flavor_id', 'name']
          }
        ],
        order: [
          [{ model: Product, as: 'product' }, 'name', 'ASC'],
          [{ model: Flavor, as: 'flavor' }, 'name', 'ASC']
        ]
      });

      // Agrupar sabores por producto
      const flavorsMap = new Map();
      productFlavors.forEach(pf => {
        const productId = pf.product_id;
        if (!flavorsMap.has(productId)) {
          flavorsMap.set(productId, {
            product_id: productId,
            product_name: pf.product.name,
            sabores: []
          });
        }
        flavorsMap.get(productId).sabores.push({
          flavor_id: pf.flavor.flavor_id,
          name: pf.flavor.name
        });
      });

      const formattedFlavors = Array.from(flavorsMap.values()).map(item => ({
        ...item,
        sabores: item.sabores.sort((a, b) => a.name.localeCompare(b.name))
      }));

      res.status(200).json({
        message: 'Sabores por producto obtenidos exitosamente',
        flavors: formattedFlavors
      });

    } catch (error) {
      console.error('Error obteniendo sabores por producto:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los sabores por producto'
      });
    }
  }
}

module.exports = MenuController;
