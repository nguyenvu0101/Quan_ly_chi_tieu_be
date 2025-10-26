import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// 🔗 Khởi tạo kết nối Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// ✅ Hàm kiểm tra kết nối — không cần truy vấn bảng
export async function testDBConnection() {
  try {
    // gọi thử API Supabase để xem server có phản hồi không
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(error.message)
    console.log('✅ Supabase client đã khởi tạo và phản hồi thành công!')
  } catch (err) {
    console.error('❌ Không thể kết nối Supabase:', err.message)
  }
}

export default supabase
