const { sequelize } = require('../config/database-sequelize');

// Importar todos los modelos
const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const Variant = require('./Variant');
const Price = require('./Price');
const Flavor = require('./Flavor');
const ProductFlavor = require('./ProductFlavor');

// Definir relaciones entre modelos

// Category -> Product (uno a muchos)
Category.hasMany(Product, {
  foreignKey: 'category_id',
  as: 'products'
});
Product.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'category'
});

// Product -> Variant (uno a muchos)
Product.hasMany(Variant, {
  foreignKey: 'product_id',
  as: 'variants'
});
Variant.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product'
});

// Variant -> Price (uno a muchos)
Variant.hasMany(Price, {
  foreignKey: 'variant_id',
  as: 'prices'
});
Price.belongsTo(Variant, {
  foreignKey: 'variant_id',
  as: 'variant'
});

// Product <-> Flavor (muchos a muchos a través de ProductFlavor)
Product.belongsToMany(Flavor, {
  through: ProductFlavor,
  foreignKey: 'product_id',
  otherKey: 'flavor_id',
  as: 'flavors'
});
Flavor.belongsToMany(Product, {
  through: ProductFlavor,
  foreignKey: 'flavor_id',
  otherKey: 'product_id',
  as: 'products'
});

// Asociaciones directas para ProductFlavor (necesarias para includes)
ProductFlavor.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product'
});
Product.hasMany(ProductFlavor, {
  foreignKey: 'product_id',
  as: 'productFlavors'
});

ProductFlavor.belongsTo(Flavor, {
  foreignKey: 'flavor_id',
  as: 'flavor'
});
Flavor.hasMany(ProductFlavor, {
  foreignKey: 'flavor_id',
  as: 'productFlavors'
});

// Exportar todos los modelos y la instancia de Sequelize
module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Variant,
  Price,
  Flavor,
  ProductFlavor
};
