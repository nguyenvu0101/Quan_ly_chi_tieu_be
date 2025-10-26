import express from 'express'
import roomController from '../app/controllers/roomController.js'
import {
  verifyToken,
  verifyTokenAndAdmin,
  verifyTokenAndUserAuthorization,
} from '../app/controllers/verifyToken.js'
const router = express.Router()
router.get('/check_code/:roomCode', roomController.checkRoomCode)
// CREATE ROOM
router.post(
  '/create',
  roomController.createRoom
)
router.post(
  '/join',
  roomController.joinRoom
)
// GET ALL ROOMS
router.get(
    '/allRooms',
    roomController.getAllRooms
)
// GET ROOM BY ID
router.get(
    '/:id',
    roomController.getUserRoom
)
// UPDATE ROOM
router.put(
    '/update/:id',
    roomController.updateRoom
)
// DELETE ROOM
router.delete(
    '/delete/:id',
    roomController.deleteRoom
)

export default router