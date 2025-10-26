import express from 'express'
import authController from '../app/controllers/authController.js'
import { verifyToken } from '../app/controllers/verifyToken.js'

const router = express.Router()

// REGISTER
router.post('/register', authController.registerUser)
// LOGIN
router.post('/login', authController.loginUser)
// LOGOUT
router.post('/logout', verifyToken, authController.logOut)
// REFRESH TOKEN
router.post('/refresh', authController.requestRefreshToken)

export default router
