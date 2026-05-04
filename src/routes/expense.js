import express from 'express'
import expenseController from '../app/controllers/expenseController.js'
import { verifyToken } from '../app/controllers/verifyToken.js'

const router = express.Router()

// POST /expenses - Thêm expense mới
router.post('/', verifyToken, expenseController.addExpense)

// GET /expenses/:room_id - Lấy expenses của phòng (chỉ user tham gia)
router.get('/:room_id', verifyToken, expenseController.getExpenses)
router.get('/detail/:expense_id', expenseController.getExpenseDetail)
// DELETE /expenses/:id - Xóa expense
router.delete('/:id', expenseController.deleteExpense)

export default router
