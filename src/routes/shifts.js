const express = require('express');
const router = express.Router();
const ShiftsController = require('../controllers/shiftsController');
const { authenticateToken } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Gestión de turnos
router.post('/', ShiftsController.openShift);
router.get('/active/:locationId', ShiftsController.getActiveShift);
router.put('/:shiftId/close', ShiftsController.closeShift);

// Historial de turnos
router.get('/', ShiftsController.getShiftHistory);
router.get('/:id', ShiftsController.getShiftById);

module.exports = router;
