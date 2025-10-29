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

  // 🔐 CẬP NHẬT THÔNG TIN USER (Avatar, QR, Thông tin cá nhân, Đổi mật khẩu)
  updateUser: async (req, res) => {
    // ✅ THÊM LOG NGAY ĐẦU
    console.log('\n========== UPDATE USER HIT ==========')
    console.log('📍 req.params:', req.params)
    console.log('📦 req.body:', req.body)
    console.log('📦 req.body type:', typeof req.body)
    console.log('🔑 req.headers:', req.headers)
    console.log('=====================================\n')

    try {
      const userId = req.params.id

      const {
        avatar_url,
        qr_url,
        full_name,
        email,
        phone,
        currentPassword,
        newPassword,
      } = req.body

      console.log('✅ Destructured values:')
      console.log('   avatar_url:', avatar_url)
      console.log('   qr_url:', qr_url)
      console.log('   full_name:', full_name)
      console.log('   email:', email)
      console.log('   phone:', phone)

      if (!userId) {
        console.log('❌ userId is missing')
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: userId not found',
        })
      }

      // ✅ XÂY DỰNG OBJECT updateData
      const updateData = {}

      if (avatar_url !== undefined) updateData.avatar_url = avatar_url
      if (qr_url !== undefined) updateData.qr_url = qr_url
      if (full_name !== undefined) updateData.full_name = full_name
      if (email !== undefined) updateData.email = email
      if (phone !== undefined) updateData.phone = phone

      console.log('📝 updateData after building:', updateData)
      console.log('📝 updateData keys:', Object.keys(updateData))

      // ✅ VALIDATION: Kiểm tra không có trường nào được gửi đi để cập nhật
      if (
        Object.keys(updateData).length === 0 &&
        !currentPassword &&
        !newPassword
      ) {
        console.log('❌ No fields to update')
        return res.status(400).json({
          success: false,
          message: 'Không có thông tin nào để cập nhật.',
          debug: {
            receivedBody: req.body,
            parsedFields: { avatar_url, qr_url, full_name, email, phone },
          },
        })
      }

      // ===== LOGIC ĐỔI MẬT KHẨU =====
      if (currentPassword && newPassword) {
        // 1. Kiểm tra mật khẩu hiện tại
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('pass_word')
          .eq('id', userId)
          .single()

        if (userError || !user) {
          return res.status(404).json({
            success: false,
            message: 'Người dùng không tồn tại.',
          })
        }

        const isMatch = await bcrypt.compare(currentPassword, user.pass_word)
        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: 'Mật khẩu hiện tại không đúng.',
          })
        }

        // 2. Hash mật khẩu mới
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(newPassword, salt)
        updateData.pass_word = hashedPassword
      }

      // Kiểm tra lỗi thiếu một trong hai trường mật khẩu
      if (
        (currentPassword && !newPassword) ||
        (!currentPassword && newPassword)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.',
        })
      }

      // ===== CẬP NHẬT DATABASE =====
      updateData.updated_at = new Date().toISOString()

      console.log('📝 Final updateData:', updateData)

      const { data, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('id, user_name, email, full_name, phone, avatar_url, qr_url')
        .single()

      if (updateError) {
        console.error('❌ Supabase update error:', updateError)
        // Lỗi này có thể là do RLS Policy hoặc sai tên cột/kiểu dữ liệu
        throw updateError
      }

      console.log('✅ User updated successfully:', data)

      // Xây dựng thông báo phản hồi
      let message = 'Cập nhật thành công'
      if (newPassword) {
        message = 'Cập nhật thông tin và đổi mật khẩu thành công!'
      } else if (avatar_url || qr_url) {
        message = 'Cập nhật ảnh thành công!'
      } else {
        message = 'Cập nhật thông tin thành công!'
      }

      return res.status(200).json({
        success: true,
        message: message,
        user: data,
      })
    } catch (error) {
      console.error('❌ Lỗi cập nhật user:', error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Có lỗi xảy ra, vui lòng thử lại.',
      })
    }
  },
}

export default userController
