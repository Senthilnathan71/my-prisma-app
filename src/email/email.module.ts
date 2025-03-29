import { Logger, Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import * as path from 'path';
import * as nodemailer from 'nodemailer';

@Module({
  providers: [EmailService, Logger],
  exports: [EmailService]
})

export class EmailModule { }