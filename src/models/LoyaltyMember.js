const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

const LoyaltyMember = sequelize.define('LoyaltyMember', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    field: 'id'
  },
  phone_number: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'phone_number'
  },
  document_id: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'document_id'
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'full_name'
  },
  points_balance: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'points_balance'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'loyalty_members',
  schema: 'naxos',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = LoyaltyMember;
