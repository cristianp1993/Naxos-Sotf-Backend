const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

/**
 * Modelo ProductFlavor para product_flavor (tabla de relación muchos a muchos)
 */
const ProductFlavor = sequelize.define('ProductFlavor', {
  product_flavor_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'product_flavor_id'
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id'
  },
  flavor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'flavor_id'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'product_flavor',
  timestamps: true,
  underscored: true
});

module.exports = ProductFlavor;
