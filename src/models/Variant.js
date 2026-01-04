const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

/**
 * Modelo Variant para product_variant
 */
const Variant = sequelize.define('Variant', {
  variant_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'variant_id'
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id'
  },
  variant_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'variant_name',
    validate: {
      len: [1, 100]
    }
  },
  ounces: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'ounces'
  },
  toppings: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'toppings',
    comment: 'Cantidad de toppings permitidos para esta variante'
  },
  sku: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'sku'
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'image_url'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'price'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'product_variant',
  timestamps: true,
  underscored: true
});

module.exports = Variant;
