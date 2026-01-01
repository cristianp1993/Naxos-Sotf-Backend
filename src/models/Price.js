const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

/**
 * Modelo Price para variant_price
 */
const Price = sequelize.define('Price', {
  price_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'price_id'
  },
  variant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'variant_id'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'price',
    validate: {
      min: 0
    }
  },
  valid_from: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'valid_from'
  },
  valid_to: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'valid_to'
  }
}, {
  tableName: 'variant_price',
  timestamps: true,
  underscored: true
});

module.exports = Price;
