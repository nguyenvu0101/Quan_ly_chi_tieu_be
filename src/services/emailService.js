import { TransactionalEmailsApi, SendSmtpEmail } from '@getbrevo/brevo'

console.log(
  '🔑 BREVO_API_KEY loaded:',
  process.env.BREVO_API_KEY ? '✅ Yes' : '❌ No'
)

export async function sendOTPEmail(email, userName, otp) {
  try {
    // ✅ TẠO API INSTANCE MỚI MỖI LẦN GỌI
    const apiInstance = new TransactionalEmailsApi()
    apiInstance.setApiKey(0, process.env.BREVO_API_KEY)

    console.log('📧 Sending OTP to:', email)

    const sendSmtpEmail = new SendSmtpEmail()

    sendSmtpEmail.subject = 'Mã OTP đặt lại mật khẩu'
    sendSmtpEmail.htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 20px auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">🔐 Đặt lại mật khẩu</h2>
            
            <p style="color: #666; margin-bottom: 15px;">Hi ${userName},</p>
            <p style="color: #666; margin-bottom: 15px;">Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
            
            <p style="color: #666; margin-bottom: 10px;">Mã OTP của bạn là:</p>
            <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; letter-spacing: 8px; margin: 0; font-family: monospace;">${otp}</h1>
            </div>
            
            <p style="color: #999; font-size: 13px; margin-bottom: 20px;">⏱️ Mã này có hiệu lực trong <strong>10 phút</strong></p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="color: #999; font-size: 12px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            <p style="color: #999; font-size: 12px;">Liên hệ support nếu có thắc mắc.</p>
          </div>
        </body>
      </html>
    `

    sendSmtpEmail.sender = {
      name: 'Quản Lý Chi Tiêu',
      email: 'nguyenvanvu112003@gmail.com',
    }

    sendSmtpEmail.to = [
      {
        email: email,
        name: userName,
      },
    ]

    // ✅ GỌI API VÀ AWAIT KẾT QUẢ
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail)

    console.log('✅ OTP email sent successfully to', email)
    console.log('📤 Brevo response:', data)

    return data
  } catch (error) {
    console.error('❌ Error sending OTP email:', error)
    throw new Error('Failed to send OTP email: ' + error.message)
  }
}
