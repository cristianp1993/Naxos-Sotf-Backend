const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

/**
 * Modelo Product para product
 */
const Product = sequelize.define('Product', {
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'product_id'
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'category_id'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: [2, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description'
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'image_url'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'product',
  schema: 'naxos',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Product;
