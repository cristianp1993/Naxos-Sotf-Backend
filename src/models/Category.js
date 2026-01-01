const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

/**
 * Modelo Category para product_category
 */
const Category = sequelize.define('Category', {
  category_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'category_id'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: [2, 100]
    }
  }
}, {
  tableName: 'product_category',
  schema: 'naxos',
  timestamps: false, // La tabla existente no tiene timestamps
  underscored: true
});

module.exports = Category;
