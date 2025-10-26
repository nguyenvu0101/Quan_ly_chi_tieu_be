import express from 'express'
import balanceController from '../app/controllers/balanceController.js'

const router = express.Router()

// GET /balances/:room_id - Lấy balances
router.get('/:room_id', balanceController.getBalances)
// GET /balances/summary/:room_id - Lấy summary balances
router.get('/summary/:room_id', balanceController.getBalanceSummary)
// POST /balances/settle/:id - Xác nhận đã trả
router.post('/settle/:id', balanceController.settleBalance)

export default router
