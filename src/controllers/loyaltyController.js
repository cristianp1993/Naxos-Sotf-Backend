const Joi = require('joi');
const { Op } = require('sequelize');
const { sequelize, LoyaltyMember, PointsLedger, RewardsCatalog } = require('../models');

// ── Esquemas de validación ──────────────────────────────────────────

const registerSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(255).required()
    .messages({ 'any.required': 'El nombre completo es obligatorio' }),
  phone_number: Joi.string().trim().pattern(/^[0-9]{7,15}$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'El teléfono debe contener entre 7 y 15 dígitos' }),
  document_id: Joi.string().trim().pattern(/^[0-9]{5,20}$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'La cédula debe contener entre 5 y 20 dígitos' }),
}).custom((value, helpers) => {
  // Al menos uno de phone_number o document_id debe existir
  if (!value.phone_number && !value.document_id) {
    return helpers.error('any.custom', { message: 'Debe proporcionar al menos teléfono o cédula' });
  }
  return value;
});

const checkPointsSchema = Joi.object({
  query: Joi.string().trim().pattern(/^[0-9]{5,20}$/).required()
    .messages({
      'any.required': 'Debe proporcionar un teléfono o cédula para consultar',
      'string.pattern.base': 'El valor debe contener solo dígitos (5-20 caracteres)'
    }),
});

const addPointsSchema = Joi.object({
  member_id: Joi.number().integer().positive().required()
    .messages({ 'any.required': 'El ID del miembro es obligatorio' }),
  sale_amount: Joi.number().positive().required()
    .messages({ 'any.required': 'El monto de la venta es obligatorio' }),
  reference_id: Joi.string().trim().max(255).allow(null, '').optional(),
  description: Joi.string().trim().max(255).allow(null, '').optional(),
});

const redeemSchema = Joi.object({
  member_id: Joi.number().integer().positive().required()
    .messages({ 'any.required': 'El ID del miembro es obligatorio' }),
  reward_id: Joi.number().integer().positive().optional(),
  points_to_redeem: Joi.number().integer().positive().optional(),
  reference_id: Joi.string().trim().max(255).allow(null, '').optional(),
  description: Joi.string().trim().max(255).allow(null, '').optional(),
}).or('reward_id', 'points_to_redeem')
  .messages({ 'object.missing': 'Debe proporcionar reward_id o points_to_redeem' });

const searchSchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required()
    .messages({ 'any.required': 'El término de búsqueda es obligatorio' }),
});

// ── Helpers ─────────────────────────────────────────────────────────

/** Sanitiza un string dejando solo dígitos */
const sanitizeDigits = (value) => (value || '').replace(/\D/g, '').trim();

/** Calcula puntos: 1 punto por cada $1.000 COP */
const calculatePoints = (saleAmount) => Math.floor(saleAmount / 1000);

// ── Controladores ───────────────────────────────────────────────────

const LoyaltyController = {

  /**
   * POST /register
   * Registra un nuevo miembro de lealtad.
   * Valida que no exista duplicado por teléfono o cédula.
   */
  async register(req, res) {
    try {
      const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: 'Error de validación',
          details: error.details.map(d => d.message),
        });
      }

      const phone = sanitizeDigits(value.phone_number) || null;
      const docId = sanitizeDigits(value.document_id) || null;
      const fullName = value.full_name.trim();

      // Verificar duplicados
      const whereConditions = [];
      if (phone) whereConditions.push({ phone_number: phone });
      if (docId) whereConditions.push({ document_id: docId });

      if (whereConditions.length > 0) {
        const existing = await LoyaltyMember.findOne({
          where: { [Op.or]: whereConditions },
        });

        if (existing) {
          const duplicateField = existing.phone_number === phone ? 'teléfono' : 'cédula';
          return res.status(409).json({
            error: 'Miembro ya registrado',
            message: `Ya existe un miembro registrado con ese ${duplicateField}.`,
          });
        }
      }

      const member = await LoyaltyMember.create({
        full_name: fullName,
        phone_number: phone,
        document_id: docId,
        points_balance: 0,
        is_active: true,
      });

      return res.status(201).json({
        message: '¡Registro exitoso! Bienvenido al programa de puntos NAXOS.',
        member: {
          id: member.id,
          full_name: member.full_name,
          phone_number: member.phone_number,
          points_balance: member.points_balance,
        },
      });
    } catch (err) {
      console.error('Error en loyalty/register:', err);
      return res.status(500).json({
        error: 'Error interno',
        message: 'No se pudo completar el registro. Intenta nuevamente.',
      });
    }
  },

  /**
   * GET /check-points?query=<teléfono o cédula>
   * Consulta pública: retorna saldo y nombre del miembro.
   */
  async checkPoints(req, res) {
    try {
      const { error, value } = checkPointsSchema.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: 'Error de validación',
          details: error.details.map(d => d.message),
        });
      }

      const searchValue = sanitizeDigits(value.query);
      if (!searchValue) {
        return res.status(400).json({
          error: 'Consulta inválida',
          message: 'Debe proporcionar un número de teléfono o cédula.',
        });
      }

      const member = await LoyaltyMember.findOne({
        where: {
          [Op.or]: [
            { phone_number: searchValue },
            { document_id: searchValue },
          ],
          is_active: true,
        },
        attributes: ['id', 'full_name', 'points_balance'],
      });

      if (!member) {
        return res.status(404).json({
          error: 'No encontrado',
          message: 'No se encontró un miembro con ese teléfono o cédula.',
        });
      }

      return res.status(200).json({
        member: {
          id: member.id,
          full_name: member.full_name,
          points_balance: member.points_balance,
        },
      });
    } catch (err) {
      console.error('Error en loyalty/check-points:', err);
      return res.status(500).json({
        error: 'Error interno',
        message: 'No se pudo consultar los puntos. Intenta nuevamente.',
      });
    }
  },

  /**
   * GET /rewards
   * Retorna el catálogo activo de recompensas.
   */
  async getRewards(req, res) {
    try {
      const rewards = await RewardsCatalog.findAll({
        where: { is_active: true },
        order: [['points_cost', 'ASC']],
        attributes: ['id', 'reward_name', 'points_cost'],
      });

      return res.status(200).json({ rewards });
    } catch (err) {
      console.error('Error en loyalty/rewards:', err);
      return res.status(500).json({
        error: 'Error interno',
        message: 'No se pudo obtener el catálogo de premios.',
      });
    }
  },

  /**
   * POST /add-points (protegida)
   * Suma puntos a un miembro. Lógica: 1 punto por cada $1.000 COP.
   * Usa transacción para garantizar atomicidad.
   */
  async addPoints(req, res) {
    try {
      const { error, value } = addPointsSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: 'Error de validación',
          details: error.details.map(d => d.message),
        });
      }

      const { member_id, sale_amount, reference_id, description } = value;
      const pointsToAdd = calculatePoints(sale_amount);

      if (pointsToAdd <= 0) {
        return res.status(400).json({
          error: 'Puntos insuficientes',
          message: 'El monto de la venta no genera puntos (mínimo $1.000 COP).',
        });
      }

      const result = await sequelize.transaction(async (t) => {
        const member = await LoyaltyMember.findOne({
          where: { id: member_id, is_active: true },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!member) {
          throw { status: 404, message: 'Miembro no encontrado o inactivo.' };
        }

        // Actualizar saldo
        member.points_balance += pointsToAdd;
        await member.save({ transaction: t });

        // Registrar en el ledger
        const ledgerEntry = await PointsLedger.create({
          member_id: member.id,
          transaction_type: 'EARN',
          points_amount: pointsToAdd,
          reference_id: reference_id || null,
          description: description || `Compra por $${sale_amount.toLocaleString('es-CO')} COP`,
        }, { transaction: t });

        return { member, ledgerEntry };
      });

      return res.status(200).json({
        message: `¡Se acumularon ${pointsToAdd} puntos exitosamente!`,
        points_added: pointsToAdd,
        new_balance: result.member.points_balance,
        transaction_id: result.ledgerEntry.id,
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error en loyalty/add-points:', err);
      return res.status(500).json({
        error: 'Error interno',
        message: 'No se pudieron acumular los puntos. Intenta nuevamente.',
      });
    }
  },

  /**
   * GET /search?q=<término> (protegida)
   * Busca miembros por nombre, teléfono o cédula (LIKE, case-insensitive).
   * Retorna máx. 15 resultados.
   */
  async search(req, res) {
    try {
      const { error, value } = searchSchema.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: 'Error de validación',
          details: error.details.map(d => d.message),
        });
      }

      const q = value.q.trim();

      const members = await LoyaltyMember.findAll({
        where: {
          is_active: true,
          [Op.or]: [
            { full_name: { [Op.iLike]: `%${q}%` } },
            { phone_number: { [Op.iLike]: `%${q}%` } },
            { document_id: { [Op.iLike]: `%${q}%` } },
          ],
        },
        attributes: ['id', 'full_name', 'phone_number', 'document_id', 'points_balance'],
        order: [['full_name', 'ASC']],
        limit: 15,
      });

      return res.status(200).json({ members });
    } catch (err) {
      console.error('Error en loyalty/search:', err);
      return res.status(500).json({
        error: 'Error interno',
        message: 'No se pudo realizar la búsqueda.',
      });
    }
  },

  /**
   * POST /redeem (protegida)
   * Redime un premio (por reward_id) o puntos directos (por points_to_redeem).
   * Valida saldo y usa transacción atómica.
   */
  async redeem(req, res) {
    try {
      const { error, value } = redeemSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: 'Error de validación',
          details: error.details.map(d => d.message),
        });
      }

      const { member_id, reward_id, points_to_redeem, reference_id, description } = value;

      const result = await sequelize.transaction(async (t) => {
        const member = await LoyaltyMember.findOne({
          where: { id: member_id, is_active: true },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!member) {
          throw { status: 404, message: 'Miembro no encontrado o inactivo.' };
        }

        let pointsCost;
        let redeemDescription;
        let rewardName = null;

        if (reward_id) {
          // Redención por premio del catálogo
          const reward = await RewardsCatalog.findOne({
            where: { id: reward_id, is_active: true },
            transaction: t,
          });

          if (!reward) {
            throw { status: 404, message: 'Premio no encontrado o no disponible.' };
          }

          pointsCost = reward.points_cost;
          redeemDescription = description || `Redención: ${reward.reward_name}`;
          rewardName = reward.reward_name;
        } else {
          // Redención por cantidad de puntos directa
          pointsCost = points_to_redeem;
          redeemDescription = description || `Redención manual: ${points_to_redeem} puntos`;
        }

        if (member.points_balance < pointsCost) {
          throw {
            status: 400,
            message: `Saldo insuficiente. Tiene ${member.points_balance} puntos y se requieren ${pointsCost}.`,
          };
        }

        // Restar puntos
        member.points_balance -= pointsCost;
        await member.save({ transaction: t });

        // Registrar en el ledger
        const ledgerEntry = await PointsLedger.create({
          member_id: member.id,
          transaction_type: 'REDEEM',
          points_amount: -pointsCost,
          reference_id: reference_id || null,
          description: redeemDescription,
        }, { transaction: t });

        return { member, pointsCost, rewardName, ledgerEntry };
      });

      const msg = result.rewardName
        ? `¡Premio "${result.rewardName}" redimido exitosamente!`
        : `¡${result.pointsCost} puntos redimidos exitosamente!`;

      return res.status(200).json({
        message: msg,
        reward_name: result.rewardName,
        points_spent: result.pointsCost,
        new_balance: result.member.points_balance,
        transaction_id: result.ledgerEntry.id,
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error en loyalty/redeem:', err);
      return res.status(500).json({
        error: 'Error interno',
        message: 'No se pudo redimir el premio. Intenta nuevamente.',
      });
    }
  },
};

module.exports = LoyaltyController;
