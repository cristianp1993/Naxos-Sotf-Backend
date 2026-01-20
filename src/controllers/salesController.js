const Joi = require('joi');
const { sequelize, Sale, SaleItem, SalePayment, Variant, Flavor } = require('../models');

const saleSchema = Joi.object({
  location_id: Joi.number().integer().positive().required(),
  customer_note: Joi.string().max(500).allow(null, '').optional()
});

const saleItemSchema = Joi.object({
  variant_id: Joi.number().integer().positive().required(),
  flavor_id: Joi.number().integer().positive().allow(null).optional(),
  quantity: Joi.number().precision(3).positive().required(),
  unit_price: Joi.number().precision(2).positive().optional()
});

const paymentSchema = Joi.object({
  method: Joi.string().valid('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO').required(),
  amount: Joi.number().precision(2).positive().required(),
  reference: Joi.string().max(100).allow(null, '').optional()
});

const fullSaleSchema = Joi.object({
  location_id: Joi.number().integer().positive().required(),
  customer_note: Joi.string().max(500).allow(null, '').optional(),
  items: Joi.array().min(1).items(saleItemSchema).required(),
  payments: Joi.array().min(1).items(paymentSchema).required()
});

const methodMapToDb = {
  EFECTIVO: 'CASH',
  TARJETA: 'CARD',
  TRANSFERENCIA: 'TRANSFER',
  OTRO: 'OTHER'
};

const methodMapFromDb = {
  CASH: 'EFECTIVO',
  CARD: 'TARJETA',
  TRANSFER: 'TRANSFERENCIA',
  OTHER: 'OTRO'
};

class SalesController {
  static async createSale(req, res) {
    try {
      const { error, value } = saleSchema.validate(req.body);
      if (error) return res.status(400).json({ error: 'Datos de entrada inválidos', message: error.details[0].message });

      const cashier_id = req.user.user_id;
      const { location_id, customer_note } = value;

      const sale = await Sale.create({
        location_id,
        cashier_id,
        customer_note: customer_note || null,
        status: 'OPEN',
        opened_at: new Date(),
        subtotal: 0,
        tax: 0,
        total: 0
      });

      return res.status(201).json({ message: 'Venta creada exitosamente', sale });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo crear la venta', details: error.message });
    }
  }

  static async getSaleById(req, res) {
    try {
      const saleId = parseInt(req.params.id);

      const sale = await Sale.findByPk(saleId, {
        include: [
          { model: SaleItem, as: 'items', include: [{ model: Variant, as: 'variant' }, { model: Flavor, as: 'flavor' }] },
          { model: SalePayment, as: 'payments' }
        ]
      });

      if (!sale) return res.status(404).json({ error: 'Venta no encontrada', message: 'La venta especificada no existe' });

      const json = sale.toJSON();
      if (json.payments && Array.isArray(json.payments)) {
        json.payments = json.payments.map(p => ({
          ...p,
          method: methodMapFromDb[p.method] || p.method
        }));
      }

      return res.status(200).json({ message: 'Venta obtenida exitosamente', sale: json });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo obtener la venta', details: error.message });
    }
  }

  static async getSales(req, res) {
    try {
      const { status, location_id, cashier_id, start_date, end_date, page = 1, limit = 20 } = req.query;

      const where = {};
      if (status) where.status = status;
      if (location_id) where.location_id = parseInt(location_id);
      if (cashier_id) where.cashier_id = parseInt(cashier_id);
      if (start_date || end_date) {
        where.opened_at = {};
        if (start_date) where.opened_at.$gte = new Date(start_date);
        if (end_date) where.opened_at.$lte = new Date(end_date);
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows, count } = await Sale.findAndCountAll({
        where,
        order: [['opened_at', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      return res.status(200).json({
        message: 'Ventas obtenidas exitosamente',
        sales: rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: count,
          total_pages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudieron obtener las ventas', details: error.message });
    }
  }

  static async cancelSale(req, res) {
    try {
      const saleId = parseInt(req.params.id);
      const { reason } = req.body;

      const sale = await Sale.findByPk(saleId);
      if (!sale) return res.status(404).json({ error: 'Venta no encontrada', message: 'La venta especificada no existe' });

      if (sale.status === 'CANCELLED') return res.status(400).json({ error: 'Venta ya cancelada', message: 'La venta ya ha sido cancelada previamente' });
      if (sale.status === 'PAID') return res.status(400).json({ error: 'Venta pagada', message: 'No se puede cancelar una venta que ya fue pagada' });

      await Sale.update(
        { status: 'CANCELLED', cancelled_at: new Date(), cancellation_reason: reason || 'Cancelada por el cajero' },
        { where: { sale_id: saleId } }
      );

      return res.status(200).json({ message: 'Venta cancelada exitosamente', sale_id: saleId, reason: reason || 'Cancelada por el cajero' });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo cancelar la venta', details: error.message });
    }
  }

  static async addSaleItem(req, res) {
    try {
      const saleId = parseInt(req.params.saleId);
      const { error, value } = saleItemSchema.validate(req.body);
      if (error) return res.status(400).json({ error: 'Datos de entrada inválidos', message: error.details[0].message });

      const sale = await Sale.findByPk(saleId);
      if (!sale) return res.status(404).json({ error: 'Venta no encontrada', message: 'La venta especificada no existe' });
      if (sale.status !== 'OPEN') return res.status(400).json({ error: 'Venta cerrada', message: 'No se pueden agregar items a una venta que no está abierta' });

      const variant = await Variant.findByPk(value.variant_id);
      if (!variant) return res.status(400).json({ error: 'Variant inválido', message: 'El variant_id no existe' });

      if (value.flavor_id) {
        const flavor = await Flavor.findByPk(value.flavor_id);
        if (!flavor) return res.status(400).json({ error: 'Flavor inválido', message: 'El flavor_id no existe' });
      }

      const unitPrice = value.unit_price !== undefined && value.unit_price !== null ? Number(value.unit_price) : Number(variant.precio_actual || 0);
      const qty = Number(value.quantity);
      const lineTotal = Number((unitPrice * qty).toFixed(2));

      const item = await SaleItem.create({
        sale_id: saleId,
        variant_id: value.variant_id,
        flavor_id: value.flavor_id || null,
        quantity: qty,
        unit_price: unitPrice,
        line_total: lineTotal
      });

      return res.status(201).json({ message: 'Item agregado a la venta exitosamente', item });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo agregar el item a la venta', details: error.message });
    }
  }

  static async updateSaleItem(req, res) {
    try {
      const itemId = parseInt(req.params.itemId);
      const { quantity, unit_price } = req.body;

      if (quantity !== undefined && Number(quantity) <= 0) return res.status(400).json({ error: 'Cantidad inválida', message: 'La cantidad debe ser un número mayor a 0' });
      if (unit_price !== undefined && Number(unit_price) <= 0) return res.status(400).json({ error: 'Precio unitario inválido', message: 'El precio unitario debe ser un número mayor a 0' });

      const item = await SaleItem.findByPk(itemId);
      if (!item) return res.status(404).json({ error: 'Item no encontrado', message: 'El item especificado no existe' });

      const patch = {};
      if (quantity !== undefined) patch.quantity = Number(quantity);
      if (unit_price !== undefined) patch.unit_price = Number(unit_price);

      const nextQty = patch.quantity !== undefined ? patch.quantity : Number(item.quantity);
      const nextUnit = patch.unit_price !== undefined ? patch.unit_price : Number(item.unit_price);
      patch.line_total = Number((nextQty * nextUnit).toFixed(2));

      await SaleItem.update(patch, { where: { sale_item_id: itemId } });
      const updated = await SaleItem.findByPk(itemId);

      return res.status(200).json({ message: 'Item actualizado exitosamente', item: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo actualizar el item', details: error.message });
    }
  }

  static async removeSaleItem(req, res) {
    try {
      const itemId = parseInt(req.params.itemId);
      await SaleItem.destroy({ where: { sale_item_id: itemId } });
      return res.status(200).json({ message: 'Item eliminado exitosamente' });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo eliminar el item', details: error.message });
    }
  }

  static async processPayment(req, res) {
    try {
      const saleId = parseInt(req.params.saleId);
      const { error, value } = paymentSchema.validate(req.body);
      if (error) return res.status(400).json({ error: 'Datos de entrada inválidos', message: error.details[0].message });

      const sale = await Sale.findByPk(saleId);
      if (!sale) return res.status(404).json({ error: 'Venta no encontrada', message: 'La venta especificada no existe' });

      const payment = await SalePayment.create({
        sale_id: saleId,
        method: methodMapToDb[value.method],
        amount: Number(value.amount),
        reference: value.reference || null,
        paid_at: new Date()
      });

      const json = payment.toJSON();
      json.method = value.method;

      return res.status(201).json({ message: 'Pago procesado exitosamente', payment: json });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo procesar el pago', details: error.message });
    }
  }

  static async createFullSale(req, res) {
    const t = await sequelize.transaction();
    try {
      const { error, value } = fullSaleSchema.validate(req.body);
      if (error) {
        await t.rollback();
        return res.status(400).json({ error: 'Datos de entrada inválidos', message: error.details[0].message });
      }

      const cashier_id = req.user.user_id;
      const { location_id, customer_note, items, payments } = value;

      const sale = await Sale.create({
        location_id,
        cashier_id,
        customer_note: customer_note || null,
        status: 'OPEN',
        opened_at: new Date(),
        subtotal: 0,
        tax: 0,
        total: 0
      }, { transaction: t });

      const variantIds = [...new Set(items.map(i => i.variant_id))];
      const variants = await Variant.findAll({ where: { variant_id: variantIds }, transaction: t });
      if (variants.length !== variantIds.length) {
        await t.rollback();
        return res.status(400).json({ error: 'Variant inválido', message: 'Uno o más variant_id no existen' });
      }

      const flavorIds = [...new Set(items.map(i => i.flavor_id).filter(Boolean))];
      if (flavorIds.length > 0) {
        const flavors = await Flavor.findAll({ where: { flavor_id: flavorIds }, transaction: t });
        if (flavors.length !== flavorIds.length) {
          await t.rollback();
          return res.status(400).json({ error: 'Flavor inválido', message: 'Uno o más flavor_id no existen' });
        }
      }

      const variantById = new Map(variants.map(v => [v.variant_id, v]));

      let subtotal = 0;
      const itemsPayload = items.map(i => {
        const v = variantById.get(i.variant_id);
        const unitPrice = i.unit_price !== undefined && i.unit_price !== null ? Number(i.unit_price) : Number(v.precio_actual || 0);
        const qty = Number(i.quantity);
        const lineTotal = Number((unitPrice * qty).toFixed(2));
        subtotal += lineTotal;
        return {
          sale_id: sale.sale_id,
          variant_id: i.variant_id,
          flavor_id: i.flavor_id || null,
          quantity: qty,
          unit_price: unitPrice,
          line_total: lineTotal
        };
      });

      await SaleItem.bulkCreate(itemsPayload, { transaction: t });

      const tax = 0;
      const total = Number(subtotal.toFixed(2));

      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      if (Number(totalPaid.toFixed(2)) !== Number(total.toFixed(2))) {
        await t.rollback();
        return res.status(400).json({
          error: 'Pago no cuadra',
          message: `Total venta (${total}) diferente a total pagado (${Number(totalPaid.toFixed(2))})`
        });
      }

      const paymentsPayload = payments.map(p => ({
        sale_id: sale.sale_id,
        method: methodMapToDb[p.method],
        amount: Number(p.amount),
        reference: p.reference || null,
        paid_at: new Date()
      }));

      await SalePayment.bulkCreate(paymentsPayload, { transaction: t });

      await Sale.update({
        subtotal,
        tax,
        total,
        status: 'PAID',
        paid_at: new Date()
      }, { where: { sale_id: sale.sale_id }, transaction: t });

      await t.commit();

      const fullSale = await Sale.findByPk(sale.sale_id, {
        include: [
          { model: SaleItem, as: 'items' },
          { model: SalePayment, as: 'payments' }
        ]
      });

      const json = fullSale.toJSON();
      if (json.payments && Array.isArray(json.payments)) {
        json.payments = json.payments.map(p => ({
          ...p,
          method: methodMapFromDb[p.method] || p.method
        }));
      }

      return res.status(201).json({ message: 'Venta creada exitosamente', sale: json });
    } catch (error) {
      await t.rollback();
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo crear la venta', details: error.message });
    }
  }
}

module.exports = SalesController;