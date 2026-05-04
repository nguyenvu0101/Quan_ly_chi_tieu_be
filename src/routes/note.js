import express from 'express'
import noteController from '../app/controllers/noteController.js'

const router = express.Router()

// Lấy tất cả ghi chú của người dùng
router.get('/:userId', noteController.getNotesByUser)

// Tạo ghi chú mới
router.post('/:userId', noteController.createNote)

// Cập nhật ghi chú
router.put('/:noteId', noteController.updateNote)

// Xóa ghi chú
router.delete('/:noteId', noteController.deleteNote)

export default router
