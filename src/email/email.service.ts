import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
// import * as nodemailer from 'nodemailer'
// import * as path from 'path';
// import nodemailerHbs from 'nodemailer-express-handlebars'; // Correct import

@Injectable()

export class EmailService {
    public cc: Array<string> = []
    public applicationName: String = 'CRM'
    // private transporter: nodemailer.Transporter

    // constructor() {
    //     this.transporter = nodemailer.createTransport({
    //         host: 'smtp.zoho.com',
    //         port: 587,
    //         ignoreTLS: false,
    //         secure: false,
    //         auth: {
    //             user: 'noreply@dofi.co',
    //             pass: 'March@2025',
    //         },
    //     })

    //     const hbsConfig = {
    //         viewEngine: {
    //             extName: '.hbs',
    //             partialsDir: path.join(__dirname, 'templates/'),
    //             layoutsDir: path.join(__dirname, 'templates/'),
    //             defaultLayout: '',
    //         },
    //         viewPath: path.join(__dirname, 'templates/'),
    //         extName: '.hbs',
    //     };

    //     this.transporter.use('compile', nodemailerHbs(hbsConfig)); // Use the correct function
    // }


    // async sendForgotPasswordMail(data: any) {
    //     try {

    //         const mailOptions = {
    //             from: '"Dofi-Infosys" <noreply@dofi.co>',
    //             to: data.email,
    //             subject: `Hello ${data.name}, Reset Your Password for CRM`,
    //             template: 'forgot-password',
    //             context: {
    //                 name: data.name,
    //                 resetLink: data.link
    //             }
    //         };

    //         return new Promise((resolve, reject) => {
    //             this.transporter.sendMail(mailOptions, (error, info) => {
    //                 if (error) {
    //                     return reject(new Error('Failed to send mail'))
    //                 }
    //                 return resolve(true)
    //             });
    //         })
    //     } catch (err) {
    //         throw new HttpException(
    //             {
    //                 message: `Error in sending forgot password email: ${err.message}`
    //             },
    //             HttpStatus.EXPECTATION_FAILED
    //         )
    //     }
    // }
}