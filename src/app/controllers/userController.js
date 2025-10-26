import bcrypt from 'bcrypt'
import supabase from '../../config/db/index.js'

const userController = {
  // 🧾 LẤY TẤT CẢ USER
  getAllUsers: async (req, res) => {
    try {
      const { data: allUser, error } = await supabase.from('users').select('*')
      if (error) throw error
      res.status(200).json(allUser)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // 🔍 LẤY USER THEO ID
  getUser: async (req, res) => {
    try {
      const { id } = req.params
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      res.status(200).json(user)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // 🗑️ XOÁ USER
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params
      const { error } = await supabase.from('users').delete().eq('id', id)
      if (error) throw error
      res.status(200).json('User deleted')
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // 🔐 ĐỔI MẬT KHẨU USER
  updateUser: async (req, res) => {
    try {
      const userId = req.user?.id // Lấy ID người dùng từ middleware xác thực
      const { currentPassword, newPassword } = req.body

      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: 'Vui lòng nhập đầy đủ thông tin.' })
      }

      // Lấy thông tin người dùng hiện tại
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError || !user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại.' })
      }

      // Kiểm tra mật khẩu cũ
      const isMatch = await bcrypt.compare(currentPassword, user.password)
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: 'Mật khẩu hiện tại không đúng.' })
      }

      // Mã hoá mật khẩu mới
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(newPassword, salt)

      // Cập nhật vào DB
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', userId)

      if (updateError) throw updateError

      res.status(200).json({ message: 'Đổi mật khẩu thành công!' })
    } catch (error) {
      console.error('Lỗi đổi mật khẩu:', error)
      res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại.' })
    }
  },
}

export default userController
