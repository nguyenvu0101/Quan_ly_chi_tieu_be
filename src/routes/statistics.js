import express from 'express'
import { statisticsController } from '../app/controllers/statisticsController.js'

const router = express.Router()

// GET /statistics/:user_id/monthly?month=11&year=2025
router.get('/:user_id/monthly', statisticsController.getMonthlyExpenseStats)

// GET /statistics/:user_id/today
router.get('/:user_id/today', statisticsController.getTodayExpense)

// GET /statistics/:user_id/range?start_date=2025-11-01&end_date=2025-11-30
router.get('/:user_id/range', statisticsController.getExpensesByDateRange)

export default router
