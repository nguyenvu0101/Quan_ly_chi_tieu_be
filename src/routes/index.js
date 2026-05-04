import authRouter from './auth.js'
import userRouter from './user.js'
import roomRouter from './room.js'
import expense from './expense.js'
import balance from './balance.js'
import statisticsRouter from './statistics.js'
import noteRouter from './note.js'
export default function route(app) {
  app.use('/auth', authRouter)
  app.use('/user', userRouter)
  app.use('/rooms', roomRouter)
  app.use('/expenses', expense)
  app.use('/balances', balance)
  app.use('/statistics', statisticsRouter)
  app.use('/notes', noteRouter)
}
