export interface ResetPasswordEmailData {
  name: string;
  resetLink: string;
  expiryTime: string;
  currentYear: number;
}

export function getResetPasswordEmailHtml(data: ResetPasswordEmailData): string {
  const { name, resetLink, expiryTime, currentYear } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #000000 0%, #333333 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">🔒 Password Reset</h1>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <div style="font-size: 18px; margin-bottom: 20px; color: #333;">
        Hello ${name},
      </div>

      <div style="font-size: 16px; color: #555; margin-bottom: 30px; line-height: 1.8;">
        We received a request to reset your password for your Ecommerce Platform account. Click the button below to create a new password:
      </div>

      <!-- Button -->
      <div style="text-align: center; margin: 40px 0;">
        <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Reset Password</a>
      </div>

      <!-- Expiry Notice -->
      <div style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; font-size: 14px; color: #856404;">
        <strong>⏱ Important:</strong> This password reset link will expire in ${expiryTime}. If you need a new link, please request another password reset.
      </div>

      <!-- Alternative Link -->
      <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 6px; font-size: 14px; color: #666; word-break: break-all;">
        <p style="margin: 0 0 10px 0; font-weight: 600; color: #333;">If the button doesn't work, copy and paste this link into your browser:</p>
        <a href="${resetLink}" style="color: #0066cc; text-decoration: none;">${resetLink}</a>
      </div>

      <!-- Security Notice -->
      <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 4px; font-size: 14px; color: #666;">
        <strong>🛡️ Security Note:</strong> If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security. Your password will remain unchanged.
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 30px; text-align: center; font-size: 13px; color: #999; border-top: 1px solid #e0e0e0;">
      <p style="margin: 0 0 10px 0;">&copy; ${currentYear} Ecommerce Platform. All rights reserved.</p>
      <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
