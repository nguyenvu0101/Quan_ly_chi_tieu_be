import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import path from 'path'
import { fileURLToPath } from 'url'
import supabase, { testDBConnection } from './config/db/index.js' // ✅ chuẩn nhất
import route from './routes/index.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 3003

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))
app.use(cors())
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

route(app)
app.get('/health', (req, res) => {
  res.status(200).send('OK')
})
// ✅ Gọi đúng hàm testDBConnection
await testDBConnection()

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server đang chạy tại cổng ${port}`)
})
