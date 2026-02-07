const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    field: 'id'
  },
  expense_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'expense_date'
  },
  concept: {
    type: DataTypes.STRING(150),
    allowNull: false,
    field: 'concept'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'amount',
    validate: {
      min: {
        args: [0],
        msg: 'El monto debe ser mayor o igual a cero'
      }
    }
  }
}, {
  tableName: 'expense',
  schema: 'naxos',
  timestamps: false,
  indexes: [
    {
      name: 'idx_expense_expense_date',
      fields: ['expense_date']
    }
  ]
});

module.exports = Expense;
