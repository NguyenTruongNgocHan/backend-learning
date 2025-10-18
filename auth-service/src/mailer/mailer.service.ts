import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type MailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    const host = process.env.MAIL_HOST || 'localhost';
    const port = Number(process.env.MAIL_PORT || 1025);
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    this.from = process.env.MAIL_FROM || 'no-reply@example.com';

    // Nếu có user/pass → bật auth; nếu không → chạy kiểu local catcher (MailHog/Mailpit)
    const useAuth = !!(user && pass);

    const secure = process.env.MAIL_SECURE === 'true'; // true -> 465, false -> 587

    const tlsInsecure = process.env.MAIL_TLS_INSECURE === 'true';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: useAuth ? { user, pass } : undefined,
      tls: { rejectUnauthorized: !tlsInsecure }, // nếu true -> chấp nhận self-signed
    });


    // Xác minh config khi khởi tạo (log cảnh báo nếu lỗi)
    this.transporter.verify((err, success) => {
      if (err) {
        this.logger.warn(
          `Mailer transport verify failed: ${err?.message || err}`,
        );
      } else {
        this.logger.log(
          `Mailer ready (host=${host}, port=${port}, auth=${useAuth ? 'on' : 'off'})`,
        );
      }
    });
  }

  /** Gửi mail thô (dùng cho các template khác) */
  async send(input: MailInput) {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { messageId: info.messageId };
  }

  /** Gửi OTP xác minh email */
  async sendVerifyEmail(to: string, otp: string) {
    const html = `
      <p>Your verification code (valid for 15 minutes):</p>
      <h2 style="letter-spacing:3px;font-family:monospace">${otp}</h2>
    `;
    return this.send({ to, subject: 'Your verification code', html });
  }

  /** Gửi link reset password */
  async sendForgotPasswordEmail(to: string, rawToken: string) {
    const resetUrl = `https://yourapp.com/reset-password?token=${rawToken}`;
    const html = `
      <p>We received a request to reset your password.</p>
      <p>Click the link below to proceed. This link will expire soon.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
    `;
    return this.send({ to, subject: 'Reset your password', html });
  }
}
