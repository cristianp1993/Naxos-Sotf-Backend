const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database-sequelize');

class User extends Model {
  static async authenticate(username, password) {
    const user = await User.scope('withPassword').findOne({
      where: { username },
    });

    if (!user || !user.is_active) return null;

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return null;

    const { password_hash, ...safe } = user.get({ plain: true });
    return safe;
  }

  async checkPassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }
}

User.init(
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      unique: true,
      validate: { isEmail: true },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'ADMIN',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    schema: process.env.DB_SCHEMA || 'naxos',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultScope: {
      attributes: { exclude: ['password_hash'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password_hash'] },
      },
    },
  }
);

module.exports = User;
