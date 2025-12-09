
import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import * as nodemailer from 'nodemailer';
import { DatabaseService } from "src/database/database.service";

interface EmailConfig {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    replyToEmail?: string;
}

@Injectable()
export class EmailService {
    public cc: Array<string> = []
    public applicationName: String = 'CRM'

    private transporter: nodemailer.Transporter

    constructor(
        private logger: Logger,
        private db: DatabaseService
    ) {
        // Default transporter for backward compatibility
        this.transporter = nodemailer.createTransport({
            host: 'smtp.zoho.com',
            port: 587,
            secure: false,
            auth: {
                user: 'noreply@dofi.co',
                pass: 'admin@CRM',
            },
            tls: {
                rejectUnauthorized: false,
            },
            debug: true,
            logger: true,
        });
    }

    /**
     * Create a transporter with company-specific email configuration
     */
    private createTransporterFromConfig(emailConfig: EmailConfig): nodemailer.Transporter {
        return nodemailer.createTransport({
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort,
            secure: emailConfig.smtpSecure,
            auth: {
                user: emailConfig.smtpUser,
                pass: emailConfig.smtpPassword,
            },
            tls: {
                rejectUnauthorized: false,
            },
            debug: true,
            logger: true,
        });
    }

    /**
     * Get email configuration from company config
     */
    async getCompanyEmailConfig(companyId: number): Promise<EmailConfig | null> {
        try {
            const company = await this.db.companyMaster.findUnique({
                where: { CompanyMasterSid: companyId },
                select: { config: true }
            });

            if (!company || !company.config) {
                this.logger.warn(`No config found for company ${companyId}`);
                return null;
            }

            const config = company.config as any;
            const emailConfig = config?.systemSettings?.emailConfig;

            if (!emailConfig || !emailConfig.smtpHost || !emailConfig.fromEmail) {
                this.logger.warn(`Invalid email config for company ${companyId}`);
                return null;
            }

            return emailConfig as EmailConfig;
        } catch (error) {
            this.logger.error(`Error fetching company email config: ${error.message}`);
            return null;
        }
    }

    async sendForgotPasswordMail(data: any): Promise<boolean> {
        try {
            const mailOptions = {
                from: '"Dofi-Infosys" <noreply@dofi.co>',
                to: data.email,
                subject: data.subject,
                html: data.html
            };

            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`sendForgotPasswordMail: ${JSON.stringify(info)}`)
            return true;
        } catch (err) {
            this.logger.warn(`sendForgotPasswordMail: ${JSON.stringify(err)}`)
            throw new HttpException(
                { message: `Error in sending forgot password email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
    }


    async sendEmail(data: any): Promise<boolean> {
        try {
            const mailOptions: any = {
                from: '"Dofi-Infosys" <noreply@dofi.co>',
                to: data.email,
                subject: data.subject,
                html: data.html
            };

            // Add CC if provided
            if (data.cc) {
                mailOptions.cc = data.cc;
            }

            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`sendEmail: ${JSON.stringify(info)}`);
            return true;
        } catch (err) {
            this.logger.warn(`sendEmail error: ${JSON.stringify(err)}`);
            throw new HttpException(
                { message: `Error sending email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
    }



    async sendEmailWithFileAttachment(data: any): Promise<boolean> {
        try {
            const mailOptions: any = {
                from: '"Dofi-Infosys" <noreply@dofi.co>',
                to: data.email,
                cc: data.cc,
                subject: data.subject,
                html: data.html,
                attachments: [
                    {
                        filename: data.file.originalname,
                        content: data.file.buffer,
                        contentType: data.file.mimetype,
                    }
                ]
            };
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`sendEmail: ${JSON.stringify(info)}`);
            return true;
        } catch (err) {
            this.logger.warn(`sendEmail error: ${JSON.stringify(err)}`);
            throw new HttpException(
                { message: `Error sending email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
    }

    async sendFollowupEmail(data: any): Promise<boolean> {
        try {
            const mailOptions: any = {
                from: '"Dofi-Infosys" <noreply@dofi.co>',
                to: data.email,
                cc: data.cc,
                subject: data.subject,
                html: data.html,
            };
            if(data.file){
                mailOptions['attachments']=[
                    {
                        filename: data.file.originalname,
                        content: data.file.buffer,
                        contentType: data.file.mimetype,
                    }
                ]
            }
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`sendFollowupEmail: ${JSON.stringify(info)}`);
            return true;
        } catch (err) {
            this.logger.warn(`sendFollowupEmail error: ${JSON.stringify(err)}`);
            throw new HttpException(
                { message: `Error sending email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
    }

    async sendEmailWithFullContent(data: any): Promise<boolean> {
        try {
            const mailOptions: any = {
                from: '"Dofi-Infosys" <noreply@dofi.co>',
                to: data.email,
                cc: data.cc || '',
                bcc: data.bcc || '',
                subject: data.subject,
                html: data.html,
                attachments: (data.attachments || []).map((file: Express.Multer.File) => {
                    return {
                    filename: file.originalname,
                    path: file.path,
                    contentType: file.mimetype,
                    }
                })
            };
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`Email sent successfully: ${info.messageId}`);
            return true;
        } catch (err) {
            this.logger.warn(`sendEmail error: ${JSON.stringify(err)}`);
            throw new HttpException(
                { message: `Error sending email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
    }

    async sendInvoiceEmail(data: {
        companyId: number;
        from?: string;
        to: string;
        cc?: string;
        subject: string;
        message: string;
        pdfBuffer: Buffer;
        filename: string;
        invoiceDetails?: any;
    }): Promise<boolean> {
        try {
            // Get company email configuration
            const emailConfig = await this.getCompanyEmailConfig(data.companyId);

            // Determine which transporter to use
            let transporterToUse: nodemailer.Transporter;
            let fromAddress: string;
            let replyTo: string | undefined;

            if (emailConfig) {
                // Use company-specific email configuration
                transporterToUse = this.createTransporterFromConfig(emailConfig);
                fromAddress = data.from || `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`;
                replyTo = emailConfig.replyToEmail;
                this.logger.log(`Using company-specific email config for company ${data.companyId}`);
            } else {
                // Fallback to default transporter
                transporterToUse = this.transporter;
                fromAddress = data.from || '"Dofi-Infosys" <noreply@dofi.co>';
                this.logger.warn(`Using default email config (company config not found for company ${data.companyId})`);
            }

            // Create HTML email body with invoice details
            const htmlBody = this.createInvoiceEmailTemplate(data.message, data.invoiceDetails);

            const mailOptions: any = {
                from: fromAddress,
                to: data.to,
                subject: data.subject,
                html: htmlBody,
                attachments: [
                    {
                        filename: data.filename,
                        content: data.pdfBuffer,
                        contentType: 'application/pdf',
                    }
                ]
            };

            // Add reply-to if available
            if (replyTo) {
                mailOptions.replyTo = replyTo;
            }

            // Add CC if provided
            if (data.cc && data.cc.trim() !== '') {
                mailOptions.cc = data.cc;
            }

            const info = await transporterToUse.sendMail(mailOptions);
            this.logger.log(`Invoice email sent successfully: ${info.messageId}`);
            return true;
        } catch (err) {
            this.logger.warn(`sendInvoiceEmail error: ${JSON.stringify(err)}`);
            throw new HttpException(
                { message: `Error sending invoice email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
    }

    private createInvoiceEmailTemplate(message: string, invoiceDetails?: any): string {
        const companyName = invoiceDetails?.companyName || 'Dofi-Infosys';
        const invoiceNumber = invoiceDetails?.invoiceNumber || 'N/A';
        const invoiceDate = invoiceDetails?.invoiceDate || 'N/A';
        const totalAmount = invoiceDetails?.totalAmount || 'N/A';
        const currency = invoiceDetails?.currency || '';

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice Email</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #4CAF50;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
        }
        .invoice-details {
            background-color: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
            border-left: 4px solid #4CAF50;
        }
        .invoice-details table {
            width: 100%;
            border-collapse: collapse;
        }
        .invoice-details td {
            padding: 8px 0;
        }
        .invoice-details td:first-child {
            font-weight: bold;
            width: 40%;
        }
        .message {
            margin: 20px 0;
            white-space: pre-wrap;
        }
        .footer {
            background-color: #333;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            border-radius: 0 0 5px 5px;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${companyName}</h1>
        <p>Invoice Notification</p>
    </div>

    <div class="content">
        <h2>Invoice Details</h2>

        <div class="invoice-details">
            <table>
                <tr>
                    <td>Invoice Number:</td>
                    <td>${invoiceNumber}</td>
                </tr>
                <tr>
                    <td>Invoice Date:</td>
                    <td>${invoiceDate}</td>
                </tr>
                <tr>
                    <td>Total Amount:</td>
                    <td><strong>${currency} ${totalAmount}</strong></td>
                </tr>
            </table>
        </div>

        <div class="message">
            ${message}
        </div>

        <p>Please find the attached invoice PDF for your reference.</p>

        <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
    </div>

    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
        `;
    }

    /**
     * Send report via email with attachment
     */
    async sendReportEmail(data: {
        companyId: number;
        from?: string;
        to: string;
        cc?: string;
        subject: string;
        reportName: string;
        reportDisplayName: string;
        message?: string;
        reportBuffer: Buffer;
        filename: string;
        format: 'EXCEL' | 'PDF' | 'CSV';
        reportDetails?: any;
    }): Promise<boolean> {
        try {
            // Get company email configuration
            const emailConfig = await this.getCompanyEmailConfig(data.companyId);

            // Determine which transporter to use
            let transporterToUse: nodemailer.Transporter;
            let fromAddress: string;
            let replyTo: string | undefined;

            if (emailConfig) {
                transporterToUse = this.createTransporterFromConfig(emailConfig);
                fromAddress = data.from || `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`;
                replyTo = emailConfig.replyToEmail;
                this.logger.log(`Using company-specific email config for company ${data.companyId}`);
            } else {
                transporterToUse = this.transporter;
                fromAddress = data.from || '"Dofi-Infosys" <noreply@dofi.co>';
                this.logger.warn(`Using default email config for company ${data.companyId}`);
            }

            // Create HTML email body with report details
            const htmlBody = this.createReportEmailTemplate(
                data.reportDisplayName,
                data.message || 'Please find the attached report for your reference.',
                data.reportDetails
            );

            // Determine content type based on format
            let contentType = 'application/octet-stream';
            if (data.format === 'PDF') {
                contentType = 'application/pdf';
            } else if (data.format === 'EXCEL') {
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            } else if (data.format === 'CSV') {
                contentType = 'text/csv';
            }

            const mailOptions: any = {
                from: fromAddress,
                to: data.to,
                subject: data.subject,
                html: htmlBody,
                attachments: [
                    {
                        filename: data.filename,
                        content: data.reportBuffer,
                        contentType: contentType,
                    }
                ]
            };

            // Add reply-to if available
            if (replyTo) {
                mailOptions.replyTo = replyTo;
            }

            // Add CC if provided
            if (data.cc && data.cc.trim() !== '') {
                mailOptions.cc = data.cc;
            }

            const info = await transporterToUse.sendMail(mailOptions);
            this.logger.log(`Report email sent successfully: ${info.messageId}`);
            return true;
        } catch (err) {
            this.logger.warn(`sendReportEmail error: ${JSON.stringify(err)}`);
            throw new HttpException(
                { message: `Error sending report email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
    }

    /**
     * Create report email template
     */
    private createReportEmailTemplate(reportName: string, message: string, reportDetails?: any): string {
        const companyName = reportDetails?.companyName || 'Dofi-Infosys';
        const generatedDate = new Date().toLocaleString();
        const parameters = reportDetails?.parameters || {};

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #007bff;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 20px;
            border: 1px solid #ddd;
        }
        .report-details {
            background-color: white;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #007bff;
        }
        .report-details h3 {
            margin-top: 0;
            color: #007bff;
        }
        .message {
            background-color: white;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }
        .footer {
            background-color: #333;
            color: white;
            text-align: center;
            padding: 15px;
            border-radius: 0 0 5px 5px;
            font-size: 12px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        table td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
        }
        table td:first-child {
            font-weight: bold;
            width: 40%;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>${companyName}</h2>
        <p>Generated Report</p>
    </div>

    <div class="content">
        <div class="report-details">
            <h3>Report Information</h3>
            <table>
                <tr>
                    <td>Report Name:</td>
                    <td>${reportName}</td>
                </tr>
                <tr>
                    <td>Generated On:</td>
                    <td>${generatedDate}</td>
                </tr>
                ${Object.keys(parameters).length > 0 ? `
                <tr>
                    <td>Report Parameters:</td>
                    <td>${Object.entries(parameters).map(([key, value]) => `${key}: ${value}`).join('<br>')}</td>
                </tr>
                ` : ''}
            </table>
        </div>

        <div class="message">
            ${message}
        </div>

        <p>Please find the attached report file for your reference.</p>

        <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
    </div>

    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
        `;
    }




    
    async sendMailConfiguration(data: any) {
        const isExistsCompany = await this.db.companyMaster.findUnique({
            where:{
                CompanyMasterSid: data.CompanyMasterSid
            }
        })

        const isExistsCompanyInMailConfiguration = await this.db.mailConfigurationMaster.findFirst({
            where:{
                CompanyMasterSid:data.CompanyMasterSid
            }
        })
        if(!isExistsCompany && !isExistsCompanyInMailConfiguration){
            try {
            const mailOptions: any = {
                from: '"Dofi-Infosys" <noreply@dofi.co>',
                to: data.email,
                subject: data.subject,
                html: data.html
            };

            // Add CC if provided
            if (data.cc) {
                mailOptions.cc = data.cc; 
            }

            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`sendEmail: ${JSON.stringify(info)}`);
            return true;
        } catch (err) {
            this.logger.warn(`sendEmail error: ${JSON.stringify(err)}`);
            throw new HttpException(
                { message: `Error sending email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
        }
    }


}
