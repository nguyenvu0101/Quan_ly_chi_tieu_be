import express from 'express'
import expenseController from '../app/controllers/expenseController.js'

const router = express.Router()

// POST /expenses - Thêm expense mới
router.post('/', expenseController.addExpense)

// GET /expenses/:room_id - Lấy expenses của phòng
router.get('/:room_id', expenseController.getExpenses)

// DELETE /expenses/:id - Xóa expense
router.delete('/:id', expenseController.deleteExpense)

export default router
