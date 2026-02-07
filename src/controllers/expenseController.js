const Expense = require('../models/Expense');
const { sequelize } = require('../config/database-sequelize');

class ExpenseController {
  // Obtener todos los gastos
  static async getAllExpenses(req, res) {
    try {
      const expenses = await Expense.findAll({
        order: [['expense_date', 'DESC'], ['id', 'DESC']]
      });
      
      return res.status(200).json(expenses);
    } catch (error) {
      console.error('Error al obtener gastos:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudieron obtener los gastos' 
      });
    }
  }

  // Obtener un gasto por ID
  static async getExpenseById(req, res) {
    try {
      const { id } = req.params;
      
      const expense = await Expense.findByPk(id);
      
      if (!expense) {
        return res.status(404).json({ 
          error: 'Gasto no encontrado', 
          message: 'El gasto especificado no existe' 
        });
      }
      
      return res.status(200).json(expense);
    } catch (error) {
      console.error('Error al obtener gasto:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudo obtener el gasto' 
      });
    }
  }

  // Crear un nuevo gasto
  static async createExpense(req, res) {
    const t = await sequelize.transaction();
    
    try {
      const { expense_date, concept, description, amount } = req.body;
      
      // Validaciones básicas
      if (!expense_date) {
        await t.rollback();
        return res.status(400).json({ 
          error: 'Datos incompletos', 
          message: 'La fecha del gasto es obligatoria' 
        });
      }
      
      if (!concept || concept.trim() === '') {
        await t.rollback();
        return res.status(400).json({ 
          error: 'Datos incompletos', 
          message: 'El concepto del gasto es obligatorio' 
        });
      }
      
      if (!amount || amount <= 0) {
        await t.rollback();
        return res.status(400).json({ 
          error: 'Datos inválidos', 
          message: 'El monto del gasto debe ser mayor a cero' 
        });
      }
      
      // Crear el gasto
      const newExpense = await Expense.create({
        expense_date,
        concept: concept.trim(),
        description: description ? description.trim() : null,
        amount: parseFloat(amount)
      }, { transaction: t });
      
      await t.commit();
      
      return res.status(201).json({
        message: 'Gasto creado exitosamente',
        expense: newExpense
      });
      
    } catch (error) {
      await t.rollback();
      console.error('Error al crear gasto:', error);
      
      // Manejar errores de validación de Sequelize
      if (error.name === 'SequelizeValidationError') {
        const errors = error.errors.map(err => ({
          field: err.path,
          message: err.message
        }));
        return res.status(400).json({
          error: 'Error de validación',
          message: 'Datos inválidos',
          details: errors
        });
      }
      
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudo crear el gasto' 
      });
    }
  }

  // Actualizar un gasto
  static async updateExpense(req, res) {
    const t = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { expense_date, concept, description, amount } = req.body;
      
      // Buscar el gasto existente
      const expense = await Expense.findByPk(id, { transaction: t });
      
      if (!expense) {
        await t.rollback();
        return res.status(404).json({ 
          error: 'Gasto no encontrado', 
          message: 'El gasto especificado no existe' 
        });
      }
      
      // Validaciones básicas
      if (!expense_date) {
        await t.rollback();
        return res.status(400).json({ 
          error: 'Datos incompletos', 
          message: 'La fecha del gasto es obligatoria' 
        });
      }
      
      if (!concept || concept.trim() === '') {
        await t.rollback();
        return res.status(400).json({ 
          error: 'Datos incompletos', 
          message: 'El concepto del gasto es obligatorio' 
        });
      }
      
      if (!amount || amount <= 0) {
        await t.rollback();
        return res.status(400).json({ 
          error: 'Datos inválidos', 
          message: 'El monto del gasto debe ser mayor a cero' 
        });
      }
      
      // Actualizar el gasto
      await expense.update({
        expense_date,
        concept: concept.trim(),
        description: description ? description.trim() : null,
        amount: parseFloat(amount)
      }, { transaction: t });
      
      await t.commit();
      
      return res.status(200).json({
        message: 'Gasto actualizado exitosamente',
        expense: expense
      });
      
    } catch (error) {
      await t.rollback();
      console.error('Error al actualizar gasto:', error);
      
      // Manejar errores de validación de Sequelize
      if (error.name === 'SequelizeValidationError') {
        const errors = error.errors.map(err => ({
          field: err.path,
          message: err.message
        }));
        return res.status(400).json({
          error: 'Error de validación',
          message: 'Datos inválidos',
          details: errors
        });
      }
      
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudo actualizar el gasto' 
      });
    }
  }

  // Eliminar un gasto
  static async deleteExpense(req, res) {
    const t = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      // Buscar el gasto existente
      const expense = await Expense.findByPk(id, { transaction: t });
      
      if (!expense) {
        await t.rollback();
        return res.status(404).json({ 
          error: 'Gasto no encontrado', 
          message: 'El gasto especificado no existe' 
        });
      }
      
      // Eliminar el gasto
      await expense.destroy({ transaction: t });
      
      await t.commit();
      
      return res.status(200).json({
        message: 'Gasto eliminado exitosamente',
        expense_id: parseInt(id)
      });
      
    } catch (error) {
      await t.rollback();
      console.error('Error al eliminar gasto:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudo eliminar el gasto' 
      });
    }
  }

  // Obtener gastos por rango de fechas
  static async getExpensesByDateRange(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      let whereClause = {};
      
      if (start_date) {
        whereClause.expense_date = {
          ...whereClause.expense_date,
          [sequelize.Op.gte]: start_date
        };
      }
      
      if (end_date) {
        whereClause.expense_date = {
          ...whereClause.expense_date,
          [sequelize.Op.lte]: end_date
        };
      }
      
      const expenses = await Expense.findAll({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        order: [['expense_date', 'DESC'], ['id', 'DESC']]
      });
      
      return res.status(200).json(expenses);
    } catch (error) {
      console.error('Error al obtener gastos por rango de fechas:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudieron obtener los gastos' 
      });
    }
  }

  // Obtener resumen de gastos por mes
  static async getExpensesSummary(req, res) {
    try {
      const { year } = req.query;
      
      let whereClause = {};
      
      if (year) {
        whereClause.expense_date = {
          [sequelize.Op.between]: [
            `${year}-01-01`,
            `${year}-12-31`
          ]
        };
      }
      
      const expenses = await Expense.findAll({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('expense_date')), 'month'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'total']
        ],
        group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('expense_date'))],
        order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('expense_date')), 'DESC']]
      });
      
      return res.status(200).json(expenses);
    } catch (error) {
      console.error('Error al obtener resumen de gastos:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor', 
        message: 'No se pudo obtener el resumen de gastos' 
      });
    }
  }
}

module.exports = ExpenseController;
