import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class NotificationService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendInvitationEmail(
    email: string,
    companyName: string,
    invitationToken: string,
    invitedBy: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const acceptInviteUrl = `${frontendUrl}/accept-invite?token=${invitationToken}`;

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
}
