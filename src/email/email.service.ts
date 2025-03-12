import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import * as nodemailer from 'nodemailer'
import nodemailerHbs from 'nodemailer-express-handlebars'; // Correct import
@Injectable()

export class EmailService {
    public cc: Array<string> = []
    public applicationName: String = 'CRM'

    private transporter: nodemailer.Transporter

    constructor() {
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

        const hbsConfig = {
            viewEngine: {
                extName: '.hbs',
                partialsDir: 'src/email/templates/',
                layoutsDir: 'src/email/templates/',
                defaultLayout: '',
            },
            viewPath: 'src/email/templates/',
            extName: '.hbs',
        };

        this.transporter.use('compile', nodemailerHbs(hbsConfig)); // Use the correct function
    }

    async sendForgotPasswordMail(data: any): Promise<boolean> {
        try {
            const mailOptions = {
                from: '"Dofi-Infosys" <noreply@dofi.co>',
                to: data.email,
                subject: `Hello ${data.name}, Reset Your Password for CRM`,
                template: 'forgot-password',
                context: { name: data.name, resetLink: data.link },
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent:', info.response);
            return true;
        } catch (err) {
            console.error('Error sending email:', err);
            throw new HttpException(
                { message: `Error in sending forgot password email: ${err.message}` },
                HttpStatus.EXPECTATION_FAILED
            );
        }
    }

}
