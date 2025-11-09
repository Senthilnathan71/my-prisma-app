import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';

export interface ReportEmailOptions {
  reportType: string;
  recipients: {
    to: string[];
    cc?: string[];
    bcc?: string[];
  };
  subject: string;
  body: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
  data?: Record<string, any>;
}

@Injectable()
export class ReportEmailService {
  private readonly logger = new Logger(ReportEmailService.name);

  constructor(private readonly emailService: EmailService) {}

  async sendReportEmail(options: ReportEmailOptions): Promise<boolean> {
    this.logger.log(`Sending ${options.reportType} report email...`);

    try {
      const emailPayload = {
        to: options.recipients.to,
        cc: options.recipients.cc || [],
        bcc: options.recipients.bcc || [],
        subject: this.processTemplate(options.subject, options.data),
        html: this.processTemplate(options.body, options.data),
        attachments: options.attachments
      };

      await this.emailService.sendEmail(emailPayload);
      this.logger.log(`${options.reportType} email sent successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send ${options.reportType} email:`, error);
      throw error;
    }
  }

  private processTemplate(template: string, data?: Record<string, any>): string {
    if (!data) return template;

    let result = template;
    Object.keys(data).forEach((key) => {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      const value = data[key] !== null && data[key] !== undefined ? String(data[key]) : '';
      result = result.replace(placeholder, value);
    });

    return result;
  }
}
