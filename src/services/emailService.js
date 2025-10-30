// src/services/emailService.js

import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// Test connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Gmail connection error:', error)
  } else {
    console.log('✅ Gmail ready to send emails')
  }
})

export const sendOTPEmail = async (email, fullName, otp) => {
  try {
    const mailOptions = {
      from: {
        name: 'Quản lý Chi tiêu',
        address: process.env.GMAIL_USER,
      },
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { font-size: 28px; margin-bottom: 10px; }
            .content { padding: 40px 30px; }
            .greeting { font-size: 16px; color: #333; margin-bottom: 20px; }
            .otp-container { background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%); border: 3px dashed #007AFF; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; }
            .otp-code { font-size: 48px; font-weight: bold; color: #007AFF; letter-spacing: 10px; font-family: 'Courier New', monospace; }
            .warning { background: #fff3cd; border-left: 4px solid #ff9500; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .warning-text { color: #856404; font-size: 14px; }
            .footer { background: #f8f8f8; padding: 30px; text-align: center; color: #666; font-size: 13px; }
            .footer a { color: #007AFF; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Đặt lại mật khẩu</h1>
              <p>Mã xác thực OTP của bạn</p>
            </div>
            
            <div class="content">
              <div class="greeting">
                Xin chào <strong>${fullName}</strong>,
              </div>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Quản lý Chi tiêu. 
                Vui lòng sử dụng mã OTP bên dưới để tiếp tục:
              </p>
              
              <div class="otp-container">
                <div style="color: #666; font-size: 14px; margin-bottom: 10px;">MÃ XÁC THỰC OTP</div>
                <div class="otp-code">${otp}</div>
              </div>
              
              <div class="warning">
                <div class="warning-text">
                  ⏰ <strong>Lưu ý quan trọng:</strong><br>
                  • Mã này có hiệu lực trong <strong>10 phút</strong><br>
                  • Không chia sẻ mã này với bất kỳ ai<br>
                  • Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này
                </div>
              </div>
              
              <p style="color: #999; font-size: 13px; margin-top: 30px; text-align: center;">
                Email này được gửi tự động, vui lòng không trả lời.
              </p>
            </div>
            
            <div class="footer">
              <p><strong>Quản lý Chi tiêu</strong></p>
              <p style="margin: 10px 0;">Ứng dụng quản lý tài chính cá nhân</p>
              <p>© 2025 All rights reserved</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }

    const info = await transporter.sendMail(mailOptions)

    console.log('✅ Email sent successfully to:', email)
    console.log('📧 Message ID:', info.messageId)

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Error sending email:', error)
    throw new Error('Failed to send OTP email')
  }
}
