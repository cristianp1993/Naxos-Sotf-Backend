const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

const RewardsCatalog = sequelize.define('RewardsCatalog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    field: 'id'
  },
  reward_name: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'reward_name'
  },
  points_cost: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'points_cost'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'rewards_catalog',
  schema: 'naxos',
  timestamps: false
});

module.exports = RewardsCatalog;
