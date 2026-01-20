const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

const SaleItem = sequelize.define('SaleItem', {
  sale_item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'sale_item_id'
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'sale_id'
  },
  variant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'variant_id'
  },
  flavor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'flavor_id'
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    field: 'quantity'
  },
  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'unit_price'
  },
  line_total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'line_total'
  }
}, {
  tableName: 'sale_item',
  schema: 'naxos',
  timestamps: false
});

module.exports = SaleItem;
