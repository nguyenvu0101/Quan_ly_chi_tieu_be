import express from 'express'
import userController from '../app/controllers/userController.js'
import {
  verifyToken,
  verifyTokenAndAdmin,
  verifyTokenAndUserAuthorization,
} from '../app/controllers/verifyToken.js'

const router = express.Router()

// GET ALL USERS
router.get('/allUser', verifyTokenAndAdmin, userController.getAllUsers)

// GET USER BY ID
router.get('/info/:id', verifyTokenAndUserAuthorization, userController.getUser)

// UPDATE USER PASSWORD
router.put(
  '/update/:id',
  verifyTokenAndUserAuthorization,
  userController.updateUser
)

// DELETE USER
router.delete(
  '/delete/:id',
  verifyTokenAndUserAuthorization,
  userController.deleteUser
)

export default router
