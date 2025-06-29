import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class EmailLogService {
    constructor(private _db: DatabaseService, private emailService: EmailService, private logger: Logger) { }


    async createEmailLog(payload: any, user) {
        this.logger.warn(`createEmailLog: ${payload}`);

        try {
            const emailLog = await this._db.emailLog.create({
                data: {
                    ...payload,
                }
            });


            const emailSent = await this.emailService.sendEmail({
                email: payload.EmailTo,
                cc: payload.EmailCC,
                subject: payload.Subject,
                html: payload.EmailBody
            })

            if (!emailSent) {
                this.logger.warn(`Failed to send password reset email`);
                throw 'Failed to send password reset email'
            }

            return emailLog;
        } catch (error) {
            throw new Error(`Error creating emailLog: ${error.message}`);
        }
    }


    async getAllEmailLogs() {
        try {
            const emailLogList = await this._db.emailLog.findMany({
                where: {
                    Status: 'A'
                }
            })
            return emailLogList;
        } catch (error) {
            throw error
        }
    }



    async findOne(emailLogMasterSid: any) {
        try {
            return await this._db.emailLog.findUnique({
                where: {
                    EmailLogSid: emailLogMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateEmailLog(emailLogMasterSid: number, payload: any, user) {

        const existing = await this._db.emailLog.findUnique({
            where: {
                EmailLogSid: emailLogMasterSid
            }
        });

        if (!existing) {
            throw new Error('emailLog is not exists');
        }

        try {
            const emailLog = await this._db.emailLog.update({
                where: {
                    EmailLogSid: emailLogMasterSid
                }, data: payload
            });
            return emailLog;
        } catch (error) {
            throw new Error(`Error updating emailLog: ${error.message}`);
        }
    }




    async softDelete(id: number) {
        const existingemailLog = await this._db.emailLog.findUnique({
            where: { EmailLogSid: id }
        });

        if (!existingemailLog) {
            throw new NotFoundException(`emailLog with ID ${id} not found`);
        }

        if (existingemailLog.deletedAt) {
            throw new Error(`emailLog with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.emailLog.update({
            where: { EmailLogSid: id },
            data: { deletedAt: new Date() }
        });
    }

}