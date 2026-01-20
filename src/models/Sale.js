const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

const Sale = sequelize.define('Sale', {
  sale_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'sale_id'
  },
  sale_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'sale_number'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'OPEN',
    field: 'status'
  },
  location_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'location_id'
  },
  cashier_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'cashier_id'
  },
  customer_note: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'customer_note'
  },
  opened_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'opened_at'
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'paid_at'
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cancelled_at'
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'subtotal'
  },
  tax: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'tax'
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total'
  }
}, {
  tableName: 'sale',
  schema: 'naxos',
  timestamps: false
});

module.exports = Sale;
