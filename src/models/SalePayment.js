const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

const SalePayment = sequelize.define('SalePayment', {
  payment_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'payment_id'
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'sale_id'
  },
  method: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'method'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'amount'
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'paid_at'
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reference'
  }
}, {
  tableName: 'sale_payment',
  schema: 'naxos',
  timestamps: false
});

module.exports = SalePayment;
