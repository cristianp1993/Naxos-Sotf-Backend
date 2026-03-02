const Joi = require('joi');
const { sequelize, Sale, SaleItem, SalePayment, Variant, Flavor } = require('../models');
const { Op } = require('sequelize');

const saleSchema = Joi.object({
  location_id: Joi.number().integer().positive().optional(),
  observation: Joi.string().max(500).allow(null, '').optional()
});

const saleItemSchema = Joi.object({
  variant_id: Joi.number().integer().positive().required(),
  flavor_name: Joi.string().max(100).allow(null, '').optional(),
  quantity: Joi.number().precision(3).positive().required(),
  unit_price: Joi.number().precision(2).min(0).optional(),
  is_promo_2x1: Joi.boolean().optional(),
  promo_reference: Joi.string().max(50).allow(null, '').optional()
});

const paymentSchema = Joi.object({
  method: Joi.string().valid('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO').required(),
  amount: Joi.number().precision(2).positive().required(),
  reference: Joi.string().max(100).allow(null, '').optional()
});

const fullSaleSchema = Joi.object({
  location_id: Joi.number().integer().positive().optional(),
  observation: Joi.string().max(500).allow(null, '').optional(),
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

// Función para procesar promociones 2x1
const process2x1Promo = (items) => {
  const processedItems = [];
  const promoGroups = {};
  
  // Agrupar items por referencia de promoción
  items.forEach(item => {
    if (item.is_promo_2x1 && item.promo_reference) {
      if (!promoGroups[item.promo_reference]) {
        promoGroups[item.promo_reference] = [];
      }
      promoGroups[item.promo_reference].push(item);
    } else {
      processedItems.push(item);
    }
  });
  
  // Procesar cada grupo de promoción 2x1
  Object.keys(promoGroups).forEach(ref => {
    const groupItems = promoGroups[ref];
    
    if (groupItems.length === 2) {
      // Es una promoción 2x1 válida: el primero con precio normal, el segundo en 0
      groupItems[0].unit_price = Number(groupItems[0].unit_price);
      groupItems[0].line_total = Number((groupItems[0].unit_price * groupItems[0].quantity).toFixed(2));
      
      groupItems[1].unit_price = 0;
      groupItems[1].line_total = 0;
      
      processedItems.push(groupItems[0], groupItems[1]);
    } else {
      // Si no es un par completo, todos pagan precio normal
      groupItems.forEach(item => {
        item.unit_price = Number(item.unit_price);
        item.line_total = Number((item.unit_price * item.quantity).toFixed(2));
        processedItems.push(item);
      });
    }
  });
  
  return processedItems;
};

class SalesController {
  static async createSale(req, res) {
    try {
      const { error, value } = saleSchema.validate(req.body);
      if (error) return res.status(400).json({ error: 'Datos de entrada inválidos', message: error.details[0].message });

      const cashier_id = req.user.user_id;
      const { location_id, observation } = value;

      const sale = await Sale.create({
        location_id,
        cashier_id,
        observation: observation || null,
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
      const { status, location_id, cashier_id, start_date, end_date, page = 1, limit = 20, totals_only } = req.query;

      const where = {};
      if (status) where.status = status;
      if (location_id) where.location_id = parseInt(location_id);
      if (cashier_id) where.cashier_id = parseInt(cashier_id);
      if (start_date || end_date) {
        where.opened_at = {};
        if (start_date) {
          // 🔥 CORRECCIÓN: Crear rango de fecha completo para Colombia timezone
          const startDate = new Date(start_date + 'T00:00:00-05:00');
          const startDateUTC = new Date(startDate.getTime() + (5 * 60 * 60 * 1000)); // Convertir a UTC
          where.opened_at[Op.gte] = startDateUTC;
        }
        if (end_date) {
          // 🔥 CORRECCIÓN: Incluir todo el día (23:59:59) en Colombia timezone
          const endDate = new Date(end_date + 'T23:59:59-05:00');
          const endDateUTC = new Date(endDate.getTime() + (5 * 60 * 60 * 1000)); // Convertir a UTC
          where.opened_at[Op.lte] = endDateUTC;
        }
      }

      // If totals_only is true, return only totals without pagination
      if (totals_only === 'true') {
        const sales = await Sale.findAll({
          where,
          include: [
            { 
              model: SaleItem, 
              as: 'items', 
              include: [
                { model: Variant, as: 'variant' },
                { model: Flavor, as: 'flavor' }
              ]
            },
            { model: SalePayment, as: 'payments' }
          ],
          order: [['opened_at', 'DESC']]
        });

        // Transformar los datos
        const transformedSales = sales.map(sale => {
          const json = sale.toJSON();
          
          // Transformar métodos de pago
          if (json.payments && Array.isArray(json.payments)) {
            json.payments = json.payments.map(p => ({
              ...p,
              method: methodMapFromDb[p.method] || p.method
            }));
          }

          // Enriquecer items con nombres de productos y variantes
          if (json.items && Array.isArray(json.items)) {
            json.items = json.items.map(item => ({
              ...item,
              product_name: item.variant?.product?.product_name || 'Producto sin nombre',
              variant_name: item.variant?.variant_name || 'Variante sin nombre',
              flavor_name: item.flavor?.name || null,
              unit_price: item.unit_price || 0,
              line_total: item.line_total || 0
            }));
          }

          return json;
        });

        // Calculate totals
        const grandTotal = transformedSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
        const paymentMethods = {};
        
        transformedSales.forEach(sale => {
          if (sale.payments && Array.isArray(sale.payments)) {
            sale.payments.forEach(payment => {
              const method = payment.method || 'SIN METODO';
              const amount = Number(payment.amount) || 0; // 🔥 Convertir a número explícitamente
              
              if (!paymentMethods[method]) {
                paymentMethods[method] = 0;
              }
              paymentMethods[method] += amount; // 🔥 Suma numérica, no concatenación
            });
          }
        });

        return res.status(200).json({
          totals: {
            grand_total: grandTotal,
            payment_methods: paymentMethods,
            total_count: transformedSales.length
          }
        });
      }

      // Normal pagination query
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows, count } = await Sale.findAndCountAll({
        where,
        include: [
          { 
            model: SaleItem, 
            as: 'items', 
            include: [
              { model: Variant, as: 'variant' },
              { model: Flavor, as: 'flavor' }
            ]
          },
          { model: SalePayment, as: 'payments' }
        ],
        order: [['opened_at', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      // Transformar los datos para incluir nombres de productos y variantes
      const transformedSales = rows.map(sale => {
        const json = sale.toJSON();
        
        // Transformar métodos de pago
        if (json.payments && Array.isArray(json.payments)) {
          json.payments = json.payments.map(p => ({
            ...p,
            method: methodMapFromDb[p.method] || p.method
          }));
        }

        // Enriquecer items con nombres de productos y variantes
        if (json.items && Array.isArray(json.items)) {
          json.items = json.items.map(item => ({
            ...item,
            product_name: item.variant?.product?.product_name || 'Producto sin nombre',
            variant_name: item.variant?.variant_name || 'Variante sin nombre',
            flavor_name: item.flavor?.name || null,
            // Mantener los campos originales por si acaso
            unit_price: item.unit_price || 0,
            line_total: item.line_total || 0
          }));
        }

        return json;
      });

      // Check if this is a filtered request that needs totals
      if ((start_date || end_date) && !totals_only) {
        // 🔥 CORRECCIÓN: Calcular totales de TODAS las ventas filtradas, no solo la página actual
        
        // Obtener TODAS las ventas que coinciden con el filtro (sin paginación)
        const allFilteredSales = await Sale.findAll({
          where,
          include: [
            { 
              model: SaleItem, 
              as: 'items', 
              include: [
                { model: Variant, as: 'variant' },
                { model: Flavor, as: 'flavor' }
              ]
            },
            { model: SalePayment, as: 'payments' }
          ],
          order: [['opened_at', 'DESC']]
          // 🔥 SIN limit ni offset para obtener TODOS los resultados
        });

        // Transformar los datos de todas las ventas filtradas
        const allTransformedSales = allFilteredSales.map(sale => {
          const json = sale.toJSON();
          
          // Transformar métodos de pago
          if (json.payments && Array.isArray(json.payments)) {
            json.payments = json.payments.map(p => ({
              ...p,
              method: methodMapFromDb[p.method] || p.method
            }));
          }

          // Enriquecer items con nombres de productos y variantes
          if (json.items && Array.isArray(json.items)) {
            json.items = json.items.map(item => ({
              ...item,
              product_name: item.variant?.product?.product_name || 'Producto sin nombre',
              variant_name: item.variant?.variant_name || 'Variante sin nombre',
              flavor_name: item.flavor?.name || null,
              unit_price: item.unit_price || 0,
              line_total: item.line_total || 0
            }));
          }

          return json;
        });

        // Calculate totals from ALL filtered sales
        const grandTotal = allTransformedSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
        const paymentMethods = {};
        
        allTransformedSales.forEach(sale => {
          if (sale.payments && Array.isArray(sale.payments)) {
            sale.payments.forEach(payment => {
              const method = payment.method || 'SIN METODO';
              const amount = Number(payment.amount) || 0; // 🔥 Convertir a número explícitamente
              
              if (!paymentMethods[method]) {
                paymentMethods[method] = 0;
              }
              paymentMethods[method] += amount; // 🔥 Suma numérica, no concatenación
            });
          }
        });

        return res.status(200).json({
          sales: transformedSales, // Paginados para la vista
          total: count,           // Total count para paginación
          totals: {
            grand_total: grandTotal,
            payment_methods: paymentMethods
          }
        });
      }

      return res.status(200).json(transformedSales);
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudieron obtener las ventas', details: error.message });
    }
  }

  static async deleteSale(req, res) {
    const t = await sequelize.transaction();
    try {
      const saleId = parseInt(req.params.id);

      // Verificar que la venta existe
      const sale = await Sale.findByPk(saleId, {
        include: [
          { model: SaleItem, as: 'items' },
          { model: SalePayment, as: 'payments' }
        ],
        transaction: t
      });

      if (!sale) {
        await t.rollback();
        return res.status(404).json({ error: 'Venta no encontrada', message: 'La venta especificada no existe' });
      }

      // 1. Eliminar pagos primero (orden correcto para evitar errores de foreign key)
      if (sale.payments && sale.payments.length > 0) {
        const paymentIds = sale.payments.map(p => p.payment_id);
        await SalePayment.destroy({
          where: { payment_id: paymentIds },
          transaction: t
        });
      }

      // 2. Eliminar items después
      if (sale.items && sale.items.length > 0) {
        const itemIds = sale.items.map(item => item.sale_item_id);
        await SaleItem.destroy({
          where: { sale_item_id: itemIds },
          transaction: t
        });
      }

      // 3. Eliminar la venta finalmente
      await Sale.destroy({
        where: { sale_id: saleId },
        transaction: t
      });

      await t.commit();

      return res.status(200).json({ 
        message: 'Venta eliminada exitosamente', 
        sale_id: saleId,
        deleted_items: sale.items?.length || 0,
        deleted_payments: sale.payments?.length || 0
      });

    } catch (error) {
      await t.rollback();
      console.error('❌ Error eliminando venta:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudo eliminar la venta', 
        details: error.message 
      });
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
        quantity: qty
        // unit_price: omitido - el trigger lo calculará
        // line_total: omitido - el trigger lo calculará
      }, {
        fields: ['sale_id', 'variant_id', 'flavor_id', 'quantity'] // Solo estos campos
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
      // No actualizamos line_total - la base de datos lo genera automáticamente

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
      const { location_id, observation, items, payments } = value;

      // 🔥 SOLUCIÓN: Forzar hora Colombia en todas las fechas
      const nowUTC = new Date();
      const colombiaTime = new Date(nowUTC.getTime() - (5 * 60 * 60 * 1000)); // UTC-5

      const sale = await Sale.create({
        location_id,
        cashier_id,
        observation: observation || null,
        status: 'OPEN',
        opened_at: colombiaTime,  // 🔥 Usar hora Colombia
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

      const flavorNames = [...new Set(items.map(i => i.flavor_name).filter(Boolean))];
      
      let flavorMap = new Map();
      if (flavorNames.length > 0) {
        const flavors = await Flavor.findAll({ 
          where: { name: flavorNames }, 
          transaction: t 
        });
        
        // Crear mapa de nombre a ID
        flavorMap = new Map(flavors.map(f => [f.name, f.flavor_id]));
        
        // Verificar que todos los nombres existen
        const notFound = flavorNames.filter(name => !flavorMap.has(name));
        if (notFound.length > 0) {
          await t.rollback();
          return res.status(400).json({ error: 'Flavor inválido', message: `Los siguientes sabores no existen: ${notFound.join(', ')}` });
        }
      }

      const variantById = new Map(variants.map(v => [v.variant_id, v]));

      // Procesar promociones 2x1 antes de calcular totales
      const processedItems = process2x1Promo(items);
      
      let subtotal = 0;
      const itemsPayload = processedItems.map(i => {
        const v = variantById.get(i.variant_id);
        const qty = Number(i.quantity);
        
        // Usar el unit_price procesado del frontend
        const unitPrice = Number(i.unit_price);
        // Usar el line_total procesado del frontend, no recalcular
        const lineTotal = Number(i.line_total || (unitPrice * qty));
        subtotal += lineTotal;
        
        const payload = {
          sale_id: sale.sale_id,
          variant_id: i.variant_id,
          flavor_id: i.flavor_name ? Number(flavorMap.get(i.flavor_name)) : null,
          quantity: qty,
          is_promo_2x1: i.is_promo_2x1 || false,
          promo_reference: i.promo_reference || null
        };
        return payload;
      });

      await SaleItem.bulkCreate(itemsPayload, { 
        transaction: t,
        fields: ['sale_id', 'variant_id', 'flavor_id', 'quantity', 'is_promo_2x1', 'promo_reference']
      });

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
        paid_at: colombiaTime  // 🔥 Usar hora Colombia en pagos
      }));

      await SalePayment.bulkCreate(paymentsPayload, { transaction: t });

      await Sale.update({
        subtotal,
        tax,
        total,
        status: 'PAID',
        paid_at: colombiaTime  // 🔥 Usar hora Colombia también en pago
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

  static async updateSale(req, res) {
    const t = await sequelize.transaction();
    
    try {
      const saleId = parseInt(req.params.id);
      
      // Validación completa - items y pagos
      const { observation, items, payments } = req.body;
      
      if (!payments || !Array.isArray(payments) || payments.length === 0) {
        await t.rollback();
        return res.status(400).json({ error: 'Datos inválidos', message: 'Se requiere al menos un método de pago' });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        await t.rollback();
        return res.status(400).json({ error: 'Datos inválidos', message: 'Se requiere al menos un item' });
      }

      // Validar pagos individualmente
      for (const payment of payments) {
        const paymentValidation = paymentSchema.validate(payment);
        if (paymentValidation.error) {
          await t.rollback();
          return res.status(400).json({ 
            error: 'Datos de pago inválidos', 
            message: `Error en pago: ${paymentValidation.error.details[0].message}` 
          });
        }
      }

      // Validar items individualmente
      for (const item of items) {
        const itemValidation = saleItemSchema.validate(item);
        if (itemValidation.error) {
          await t.rollback();
          return res.status(400).json({ 
            error: 'Datos de item inválidos', 
            message: `Error en item: ${itemValidation.error.details[0].message}` 
          });
        }
      }

      // Verificar que la venta existe
      const existingSale = await Sale.findByPk(saleId, { transaction: t });
      if (!existingSale) {
        await t.rollback();
        return res.status(404).json({ error: 'Venta no encontrada', message: 'La venta especificada no existe' });
      }

      // Actualizar observación de la venta (si se proporciona)
      if (observation !== undefined) {
        await Sale.update(
          { observation },
          { where: { sale_id: saleId }, transaction: t }
        );
      }

      // Obtener items existentes
      const existingItems = await SaleItem.findAll({ 
        where: { sale_id: saleId }, 
        transaction: t 
      });

      // Obtener sabores para mapeo de nombres a IDs
      const flavorNames = [...new Set(items.map(i => i.flavor_name).filter(Boolean))];
      let flavorMap = new Map();
      if (flavorNames.length > 0) {
        const flavors = await Flavor.findAll({ 
          where: { name: flavorNames }, 
          transaction: t 
        });
        flavorMap = new Map(flavors.map(f => [f.name, f.flavor_id]));
      }

      // Actualizar items existentes o crear nuevos
      let subtotal = 0;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const line_total = Number(item.quantity) * Number(item.unit_price);
        subtotal += line_total;

        if (existingItems[i]) {
          // Actualizar item existente (sin line_total porque es generado)
          await SaleItem.update(
            {
              variant_id: item.variant_id,
              flavor_id: item.flavor_name ? Number(flavorMap.get(item.flavor_name)) : null,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price)
              // line_total se calcula automáticamente en la BD
            },
            { 
              where: { sale_item_id: existingItems[i].sale_item_id }, 
              transaction: t 
            }
          );
        } else {
          // Crear nuevo item (si hay más items que antes)
          await SaleItem.create(
            {
              sale_id: saleId,
              variant_id: item.variant_id,
              flavor_id: item.flavor_name ? Number(flavorMap.get(item.flavor_name)) : null,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price)
              // line_total se calcula automáticamente en la BD
            },
            { transaction: t }
          );
        }
      }

      // Eliminar items sobrantes (si hay menos items que antes)
      if (items.length < existingItems.length) {
        const itemsToDelete = existingItems.slice(items.length);
        for (const itemToDelete of itemsToDelete) {
          await SaleItem.destroy(
            { where: { sale_item_id: itemToDelete.sale_item_id }, transaction: t }
          );
        }
      }

      // Eliminar pagos existentes y crear nuevos
      await SalePayment.destroy({ where: { sale_id: saleId }, transaction: t });

      // Crear nuevos pagos
      const paymentsPayload = payments.map(p => ({
        sale_id: saleId,
        method: methodMapToDb[p.method],
        amount: Number(p.amount),
        reference: p.reference || null,
        paid_at: new Date()
      }));

      await SalePayment.bulkCreate(paymentsPayload, { transaction: t });

      // Calcular totales basados en items (precios neutros sin IVA)
      const tax = 0; // Sin IVA - precios neutros
      const total = subtotal; // Total = subtotal (sin IVA)

      // Actualizar totales de la venta
      await Sale.update({
        subtotal,
        tax,
        total,
        status: 'PAID',
        paid_at: new Date()
      }, { where: { sale_id: saleId }, transaction: t });

      await t.commit();

      // Obtener la venta actualizada con relaciones
      const updatedSale = await Sale.findByPk(saleId, {
        include: [
          { model: SaleItem, as: 'items' },
          { model: SalePayment, as: 'payments' }
        ]
      });

      const json = updatedSale.toJSON();
      if (json.payments && Array.isArray(json.payments)) {
        json.payments = json.payments.map(p => ({
          ...p,
          method: methodMapFromDb[p.method] || p.method
        }));
      }

      return res.status(200).json({ message: 'Venta actualizada exitosamente', sale: json });
    } catch (error) {
      await t.rollback();
      console.error('Error updating sale:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudo actualizar la venta', 
        details: error.message 
      });
    }
  }
}

module.exports = SalesController;
