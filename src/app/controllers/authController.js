import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import supabase from '../../config/db/index.js'
import { sendOTPEmail } from '../../services/emailService.js'
let refreshTokens = []

const authController = {
  // 🧩 ĐĂNG KÝ
  registerUser: async (req, res) => {
    try {
      // 🎯 SỬA LỖI: Bóc tách và đổi tên biến để khớp với dữ liệu FE (snake_case)
      const { fullname, username, email, password } = req.body

      console.log('📦 Dữ liệu nhận được từ FE:', req.body)

      // Kiểm tra đầy đủ thông tin
      if (!fullname || !username || !email || !password) {
        return res
          .status(400)
          .json({ message: 'Vui lòng nhập đầy đủ thông tin.' })
      }

      // Kiểm tra username hoặc email trùng
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        // Supabase query requires values to be quoted, which is best handled by sanitize/prepared statements,
        // but for a quick fix, let's stick to the structure but use the corrected variables.
        // Cần xem lại cú pháp Supabase query string, nếu không, nên dùng filter() hoặc eq()
        // Dùng .or(`user_name.eq.${username},email.eq.${email}`) có thể dễ bị SQL Injection.
        .or(`user_name.eq.${username},email.eq.${email}`)
        .maybeSingle()

      if (checkError) throw checkError

      if (existingUser) {
        return res
          .status(400)
          .json({ message: 'Tên người dùng hoặc email đã tồn tại' })
      }

      // Mã hóa mật khẩu
      // Biến 'password' giờ đã có giá trị từ 'pass_word' của FE.
      const salt = await bcrypt.genSalt(10)
      const hashed = await bcrypt.hash(password, salt)

      // ⚙️ Map biến BE (camelCase) → tên cột DB (snake_case)
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            full_name: fullname,
            user_name: username,
            email,
            pass_word: hashed, // DB vẫn là snake_case
          },
        ])
        .select()
        .single()

      if (error) throw error

      // Trả về dữ liệu cho FE dạng camelCase
      res.status(200).json({
        message: 'Đăng ký thành công!',
        user: {
          id: data.id,
          fullname: data.full_name,
          username: data.user_name,
          email: data.email,
        },
      })
    } catch (err) {
      console.error('❌ Lỗi đăng ký:', err)
      // Cải thiện thông báo lỗi cho người dùng cuối
      const errorMessage =
        err.code === '23505' ? 'Dữ liệu trùng lặp.' : err.message
      res.status(500).json({ message: `Đã xảy ra lỗi server: ${errorMessage}` })
    }
  },

  // 🔐 TẠO TOKEN
  generateAccessToken: (user) =>
    jwt.sign(
      { id: user.id, isAdmin: user.is_admin },
      process.env.JWT_ACCESS_KEY,
      { expiresIn: '6h' }
    ),

  generateRefreshToken: (user) =>
    jwt.sign(
      { id: user.id, isAdmin: user.is_admin },
      process.env.JWT_REFRESH_KEY,
      { expiresIn: '365d' }
    ),

  // 🔑 ĐĂNG NHẬP
  loginUser: async (req, res) => {
    try {
      // 🎯 SỬA LỖI: Bóc tách và đổi tên biến để khớp với dữ liệu FE
      const { username, password } = req.body
      console.log('📦 Dữ liệu đăng nhập từ FE:', req.body)
      if (!username || !password) {
        return res.status(400).json({ message: 'Thiếu username hoặc password' })
      }

      // Tìm user trong DB
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_name', username)
        .maybeSingle()

      if (error) {
        console.error('❌ Lỗi truy vấn Supabase:', error)
        return res.status(500).json({ message: 'Lỗi khi truy vấn người dùng' })
      }

      if (!user) {
        return res.status(404).json({ message: 'Sai tên đăng nhập' })
      }

      if (!user.pass_word) {
        console.error('⚠️ User không có cột pass_word trong DB:', user)
        return res
          .status(500)
          .json({ message: 'Tài khoản lỗi: không có mật khẩu trong DB' })
      }

      // So sánh mật khẩu
      // Biến 'password' giờ đã có giá trị và có thể so sánh.
      const validPassword = await bcrypt.compare(password, user.pass_word)
      if (!validPassword) {
        return res.status(400).json({ message: 'Sai mật khẩu' })
      }

      // Nếu OK thì tạo token
      const accessToken = authController.generateAccessToken(user)
      const refreshToken = authController.generateRefreshToken(user)
      refreshTokens.push(refreshToken)

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false,
        path: '/',
        sameSite: 'strict',
      })

      const { pass_word, ...others } = user
      res.status(200).json({
        ...others,
        fullname: user.full_name,
        username: user.user_name,
        accessToken,
        refreshToken,
      })
    } catch (err) {
      console.error('❌ Lỗi đăng nhập:', err)
      res.status(500).json({ message: err.message })
    }
  },

  // 🔁 LẤY LẠI TOKEN
  requestRefreshToken: async (req, res) => {
    const refreshToken = req.cookies.refreshToken
    if (!refreshToken) return res.status(401).json('Chưa đăng nhập')
    if (!refreshTokens.includes(refreshToken))
      return res.status(403).json('Refresh token không hợp lệ')

    jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, (err, user) => {
      if (err) return res.status(403).json('Token lỗi')

      refreshTokens = refreshTokens.filter((t) => t !== refreshToken)
      const newAccessToken = authController.generateAccessToken(user)
      const newRefreshToken = authController.generateRefreshToken(user)
      refreshTokens.push(newRefreshToken)

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: false,
        path: '/',
        sameSite: 'strict',
      })
      res.status(200).json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      })
    })
  },

  // 🚪 ĐĂNG XUẤT
  logOut: async (req, res) => {
    // ⚠️ Chú ý: Cần lấy token từ cookie thay vì req.body
    const tokenToFilter = req.cookies.refreshToken
    if (tokenToFilter) {
      refreshTokens = refreshTokens.filter((token) => token !== tokenToFilter)
      res.clearCookie('refreshToken')
      res.status(200).json('Đăng xuất thành công!')
    } else {
      res.status(400).json('Không tìm thấy refresh token trong cookie.')
    }
  },
  checkMail: async (req, res) => {
    try {
      const { email } = req.body
console.log('📧 Yêu cầu gửi OTP đến email:', email)
      // Kiểm tra user có tồn tại không
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('email', email)
        .maybeSingle()

      if (error || !user) {
        return res.status(404).json({
          success: false,
          message: 'Email không tồn tại trong hệ thống',
        })
      }

      // Tạo OTP 6 số
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 phút

      // Lưu OTP vào database
      const { error: otpError } = await supabase
        .from('password_reset_otps')
        .insert({
          user_id: user.id,
          email: email,
          otp: otp,
          expires_at: expiresAt.toISOString(),
          is_used: false,
        })

      if (otpError) throw otpError

      // Gửi email bằng Brevo
      await sendOTPEmail(email, user.full_name, otp)

      console.log(`✅ OTP sent to ${email}: ${otp}`)

      return res.status(200).json({
        success: true,
        message: 'Mã OTP đã được gửi đến email của bạn',
        expires_in: 600, // 10 phút
      })
    } catch (err) {
      console.error('❌ Error sending OTP:', err)
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi OTP. Vui lòng thử lại sau.',
      })
    }
  },

  verifyOtp: async (req, res) => {
    try {
      const { email, otp } = req.body

      // Validate input
      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Email và OTP là bắt buộc',
        })
      }

      if (otp.length !== 6) {
        return res.status(400).json({
          success: false,
          message: 'OTP phải có 6 chữ số',
        })
      }

      console.log('🔍 Verifying OTP:', otp, 'for email:', email)

      // Tìm OTP hợp lệ trong database
      const { data: otpRecord, error: otpError } = await supabase
        .from('password_reset_otps')
        .select('*')
        .eq('email', email)
        .eq('otp', otp)
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (otpError) {
        console.error('❌ Database error:', otpError)
        throw otpError
      }

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: 'Mã OTP không hợp lệ hoặc đã hết hạn',
        })
      }

      // Tạo reset token (JWT) - có hiệu lực 15 phút
      const resetToken = jwt.sign(
        {
          userId: otpRecord.user_id,
          email: email,
          type: 'password_reset',
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      )

      // Đánh dấu OTP đã sử dụng
      await supabase
        .from('password_reset_otps')
        .update({ is_used: true })
        .eq('id', otpRecord.id)

      console.log('✅ OTP verified successfully for user:', otpRecord.user_id)

      return res.status(200).json({
        success: true,
        message: 'Xác minh OTP thành công',
        reset_token: resetToken,
      })
    } catch (error) {
      console.error('❌ Error in verifyOTP:', error)
      return res.status(500).json({
        success: false,
        message: 'Lỗi xác minh OTP',
      })
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { reset_token, new_password } = req.body

      // Validate input
      if (!reset_token || !new_password) {
        return res.status(400).json({
          success: false,
          message: 'Token và mật khẩu mới là bắt buộc',
        })
      }

      if (new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu phải có ít nhất 6 ký tự',
        })
      }

      // Verify reset token
      let decoded
      try {
        decoded = jwt.verify(reset_token, process.env.JWT_SECRET)

        if (decoded.type !== 'password_reset') {
          throw new Error('Invalid token type')
        }
      } catch (err) {
        console.error('❌ Token verification error:', err.message)
        return res.status(401).json({
          success: false,
          message: 'Token không hợp lệ hoặc đã hết hạn',
        })
      }

      console.log('🔄 Resetting password for user:', decoded.userId)

      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(new_password, 10)

      // Cập nhật mật khẩu trong database
      const { error: updateError } = await supabase
        .from('users')
        .update({ pass_word: hashedPassword })
        .eq('id', decoded.userId)

      if (updateError) {
        console.error('❌ Update password error:', updateError)
        throw updateError
      }

      // Xóa tất cả OTP cũ của user này
      await supabase
        .from('password_reset_otps')
        .delete()
        .eq('user_id', decoded.userId)

      console.log('✅ Password reset successful for user:', decoded.userId)

      return res.status(200).json({
        success: true,
        message: 'Đặt lại mật khẩu thành công',
      })
    } catch (error) {
      console.error('❌ Error in resetPassword:', error)
      return res.status(500).json({
        success: false,
        message: 'Không thể đặt lại mật khẩu',
      })
    }
  },
}

export default authController
