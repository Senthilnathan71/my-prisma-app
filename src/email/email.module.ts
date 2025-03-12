import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import * as path from 'path';
import * as nodemailer from 'nodemailer';

@Module({
    imports:[
        NestMailerModule.forRoot({
            transport: {
              host: 'smtp.zoho.com',
              port: 587, // Zoho Mail uses 587 for TLS and 465 for SSL
              secure: false, // false means TLS will be used
              auth: {
                user: 'noreply@dofi.co',
                pass: 'admin@CRM',
              },
            },
            defaults: {
              from: '"Dofi" <noreply@dofi.co>', // Sender email
            },
          }),
    ],
    providers: [EmailService],
    exports: [EmailService]
})

export class EmailModule { }