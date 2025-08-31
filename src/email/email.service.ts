
import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import * as nodemailer from 'nodemailer'
@Injectable()

export class EmailService {
    public cc: Array<string> = []
    public applicationName: String = 'CRM'

    private transporter: nodemailer.Transporter

    constructor(private logger: Logger) {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.zoho.com',
            port: 587,
            secure: false,
            auth: {
                user: 'noreply@dofi.co',
                pass: 'admin@CRM',
            },
            tls: {
                rejectUnauthorized: false, // Ignore self-signed certificate issues
            },
            debug: true, // Enable debugging
            logger: true, // Log everything
        });


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



    async sendReportEmail(data: any): Promise<boolean> {
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
                // attachments: [
                //     {
                //         filename: data.file.originalname,
                //         content: data.file.buffer,
                //         contentType: data.file.mimetype,
                //     }
                // ]
            };
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


}
