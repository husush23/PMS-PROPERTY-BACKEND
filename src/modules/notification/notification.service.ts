import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class NotificationService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) { }

  async sendInvitationEmail(
    email: string,
    companyName: string,
    invitationToken: string,
    invitedBy: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const acceptInviteUrl = `${frontendUrl}/accept-invitation?token=${invitationToken}`;

    await this.mailerService.sendMail({
      to: email,
      subject: `You've been invited to join ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Company Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">You've been invited!</h2>
            <p>You've been invited by <strong>${invitedBy}</strong> to join <strong>${companyName}</strong> on our Property Management System.</p>
            <p>Click the button below to accept the invitation:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptInviteUrl}" 
                 style="background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size: 12px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #666; word-break: break-all;">${acceptInviteUrl}</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This invitation will expire in 7 days. If you didn't request this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `You've been invited by ${invitedBy} to join ${companyName} on our Property Management System.\n\nAccept the invitation by visiting: ${acceptInviteUrl}\n\nThis invitation will expire in 7 days.`,
    });
  }

  async sendTenantInvitationEmail(
    email: string,
    companyName: string,
    invitationToken: string,
    invitedBy: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const acceptInviteUrl = `${frontendUrl}/tenants/accept-invitation?token=${invitationToken}`;

    await this.mailerService.sendMail({
      to: email,
      subject: `You've been invited as a tenant for ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tenant Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">You've been invited as a tenant!</h2>
            <p>You've been invited by <strong>${invitedBy}</strong> to become a tenant for <strong>${companyName}</strong> on our Property Management System.</p>
            <p>To complete your registration, please set up your password by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptInviteUrl}" 
                 style="background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Set Password & Accept
              </a>
            </div>
            <p style="font-size: 12px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #666; word-break: break-all;">${acceptInviteUrl}</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This invitation will expire in 7 days. If you didn't request this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `You've been invited by ${invitedBy} to become a tenant for ${companyName} on our Property Management System.\n\nSet up your password and accept the invitation by visiting: ${acceptInviteUrl}\n\nThis invitation will expire in 7 days.`,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    name: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
            <p>Hello ${name},</p>
            <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
            <p>To reset your password, click the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 12px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This link will expire in 1 hour.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${name},\n\nWe received a request to reset your password. To reset your password, visit: ${resetUrl}\n\nThis link will expire in 1 hour.`,
    });
  }

  async sendEmailVerificationEmail(
    email: string,
    token: string,
    name: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    console.log(`[NotificationService] Attempting to send verification email to: ${email}`);
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verify Your Email Address',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            <p>Hello ${name},</p>
            <p>Thanks for signing up! Please verify your email address to activate your account and start creating your company.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}"
                 style="background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            <p style="font-size: 12px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #666; word-break: break-all;">${verifyUrl}</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
        text: `Hello ${name},\n\nThanks for signing up! Please verify your email address by visiting:\n${verifyUrl}\n\nThis link will expire in 24 hours.`,
      });
      console.log(`[NotificationService] Verification email sent successfully to: ${email}`);
    } catch (error) {
      console.error(`[NotificationService] Failed to send verification email to: ${email}`, error);
      throw error;
    }
  }

  async sendContactEmail(
    name: string,
    email: string,
    message: string,
  ): Promise<void> {
    const supportEmail = 'hi@aqalstream.com';

    await this.mailerService.sendMail({
      to: supportEmail,
      subject: `New Contact Form Submission from ${name}`,
      replyTo: email,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; }
            .content { padding: 20px 0; }
            .label { font-weight: bold; color: #555; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Contact Message</h2>
            </div>
            <div class="content">
              <p><span class="label">Name:</span> ${name}</p>
              <p><span class="label">Email:</span> ${email}</p>
              <hr>
              <p><span class="label">Message:</span></p>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    });
  }
}
