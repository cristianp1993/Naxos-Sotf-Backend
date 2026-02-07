const express = require('express');
const router = express.Router();
const ExpenseController = require('../controllers/expenseController');

// GET - Obtener todos los gastos
router.get('/', ExpenseController.getAllExpenses);

// GET - Obtener un gasto por ID
router.get('/:id', ExpenseController.getExpenseById);

// GET - Obtener gastos por rango de fechas
router.get('/range/dates', ExpenseController.getExpensesByDateRange);

// GET - Obtener resumen de gastos por mes
router.get('/summary/monthly', ExpenseController.getExpensesSummary);

// POST - Crear un nuevo gasto
router.post('/', ExpenseController.createExpense);

// PUT - Actualizar un gasto
router.put('/:id', ExpenseController.updateExpense);

// DELETE - Eliminar un gasto
router.delete('/:id', ExpenseController.deleteExpense);

module.exports = router;
