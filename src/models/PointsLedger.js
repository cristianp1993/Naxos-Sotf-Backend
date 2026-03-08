const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

const PointsLedger = sequelize.define('PointsLedger', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    field: 'id'
  },
  member_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'member_id',
    references: {
      model: 'loyalty_members',
      key: 'id'
    }
  },
  transaction_type: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'transaction_type',
    validate: {
      isIn: [['EARN', 'REDEEM', 'ADJUSTMENT']]
    }
  },
  points_amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'points_amount'
  },
  reference_id: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'reference_id'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'description'
  }
}, {
  tableName: 'points_ledger',
  schema: 'naxos',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = PointsLedger;
