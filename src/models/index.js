const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

const isClass = (fn) => {
  if (typeof fn !== 'function') return false;
  const src = Function.prototype.toString.call(fn);
  return /^class\s/.test(src);
};

const normalizeModel = (mod) => {
  if (!mod) throw new Error('Modelo inválido (undefined/null)');

  if (mod.findOne && mod.sequelize) return mod;

  if (isClass(mod)) {
    if (typeof mod.initModel === 'function') {
      const built = mod.initModel(sequelize, DataTypes);
      if (!built?.findOne) throw new Error(`initModel() no devolvió un Model válido para ${mod.name}`);
      return built;
    }

    if (typeof mod.init === 'function') {
      throw new Error(
        `El modelo clase "${mod.name}" parece ser Sequelize Model pero no está inicializado. ` +
        `Agrega static initModel(sequelize, DataTypes) en su archivo y retorna la clase.`
      );
    }

    throw new Error(`El export "${mod.name}" es una clase pero no parece un modelo Sequelize`);
  }

  if (typeof mod === 'function') {
    const built = mod(sequelize, DataTypes);
    if (!built?.findOne) throw new Error('Factory de modelo no devolvió un Model Sequelize válido');
    return built;
  }

  throw new Error('Formato de modelo no soportado');
};

const User = normalizeModel(require('./User'));
const Category = normalizeModel(require('./Category'));
const Product = normalizeModel(require('./Product'));
const Variant = normalizeModel(require('./Variant'));
const Price = normalizeModel(require('./Price'));
const Flavor = normalizeModel(require('./Flavor'));
const ProductFlavor = normalizeModel(require('./ProductFlavor'));

Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Product.hasMany(Variant, { foreignKey: 'product_id', as: 'variants' });
Variant.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Variant.hasMany(Price, { foreignKey: 'variant_id', as: 'prices' });
Price.belongsTo(Variant, { foreignKey: 'variant_id', as: 'variant' });

Product.belongsToMany(Flavor, {
  through: ProductFlavor,
  foreignKey: 'product_id',
  otherKey: 'flavor_id',
  as: 'flavors',
});
Flavor.belongsToMany(Product, {
  through: ProductFlavor,
  foreignKey: 'flavor_id',
  otherKey: 'product_id',
  as: 'products',
});

ProductFlavor.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(ProductFlavor, { foreignKey: 'product_id', as: 'productFlavors' });

ProductFlavor.belongsTo(Flavor, { foreignKey: 'flavor_id', as: 'flavor' });
Flavor.hasMany(ProductFlavor, { foreignKey: 'flavor_id', as: 'productFlavors' });

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Variant,
  Price,
  Flavor,
  ProductFlavor,
};
