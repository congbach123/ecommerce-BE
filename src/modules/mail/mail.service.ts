import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { getResetPasswordEmailHtml } from './templates/reset-password.template';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      console.warn('⚠️ RESEND_API_KEY not found. Email sending will fail.');
    }
    this.resend = new Resend(apiKey);
  }

  /**
   * Send password reset email to user
   * @param email User's email address
   * @param name User's first name
   * @param resetToken JWT reset token
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3002';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') || 'onboarding@resend.dev';

    const html = getResetPasswordEmailHtml({
      name,
      resetLink,
      expiryTime: '1 hour',
      currentYear: new Date().getFullYear(),
    });

    try {
      const { data, error } = await this.resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Password Reset Request - Ecommerce Platform',
        html,
      });

      if (error) {
        console.error('Failed to send password reset email:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }

      console.log(
        `Password reset email sent successfully to ${email} (ID: ${data.id})`,
      );
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send welcome email to new users (optional - for future use)
   * @param email User's email address
   * @param name User's first name
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') || 'onboarding@resend.dev';

    try {
      const { data, error } = await this.resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Welcome to Ecommerce Platform!',
        html: `
          <h1>Welcome ${name}!</h1>
          <p>Thank you for joining Ecommerce Platform.</p>
          <p>We're excited to have you on board.</p>
        `,
      });

      if (error) {
        console.error('❌ Failed to send welcome email:', error);
        // Don't throw error for welcome email - it's not critical
        return;
      }

      console.log(
        `✅ Welcome email sent successfully to ${email} (ID: ${data.id})`,
      );
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      // Don't throw error for welcome email - it's not critical
    }
  }
}
