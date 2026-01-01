const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database-sequelize');

/**
 * Modelo Flavor para flavor
 */
const Flavor = sequelize.define('Flavor', {
  flavor_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'flavor_id'
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
  tableName: 'flavor',
  timestamps: true,
  underscored: true
});

module.exports = Flavor;
