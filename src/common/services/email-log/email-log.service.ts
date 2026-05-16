import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';
import { PublicAccessTokenService } from 'src/common/public-access-token/public-access-token.service';

const APPROVAL_TOKEN_PLACEHOLDER = '{{APPROVAL_TOKEN}}';
const PUBLIC_QUOTATION_TOKEN_TTL_HOURS = Number(process.env.PUBLIC_QUOTATION_TOKEN_TTL_HOURS ?? 72);

@Injectable()
export class EmailLogService {
    constructor(
        private _db: DatabaseService,
        private emailService: EmailService,
        private logger: Logger,
        private publicAccessTokens: PublicAccessTokenService,
    ) { }


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
                html: payload.Mailbody
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

        if (existingemailLog.Status === 'D') {
            throw new Error(`emailLog with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.emailLog.update({
            where: { EmailLogSid: id },
            data: { Status: 'D' }
        });
    }

    async createNewEmailLog(payload: any, files: Express.Multer.File[], user) {
        console.log(files);
        try {

            let emailData: any = {};

            if (payload instanceof FormData) {

                emailData = {
                    CompanyMasterSid: parseInt(payload.get('CompanyMasterSid') as string),
                    BranchMasterSid: parseInt(payload.get('BranchMasterSid') as string),
                    EmailTo: payload.get('EmailTo') as string,
                    EmailCC: payload.get('EmailCC') as string,
                    EmailBCC: payload.get('EmailBCC') as string,
                    Subject: payload.get('Subject') as string,
                    Mailbody: payload.get('Mailbody') as string,
                    CreatedBy: payload.get('CreatedBy') as string,
                    MenuMasterSid: payload.get('MenuMasterSid') as string,
                    ResourceSid: payload.get('ResourceSid') as string,
                };
            } else {
                // Regular object payload
                emailData = {
                    CompanyMasterSid: parseInt(payload.CompanyMasterSid),
                    BranchMasterSid: parseInt(payload.BranchMasterSid),
                    EmailTo: payload.EmailTo,
                    EmailCC: payload.EmailCC,
                    EmailBCC: payload.EmailBCC,
                    Subject: payload.Subject,
                    Mailbody: payload.Mailbody,
                    CreatedBy: payload.CreatedBy,
                    MenuMasterSid: payload.MenuMasterSid,
                    ResourceSid: payload.ResourceSid,
                };
            }

            let fullMailBody: string = emailData.Mailbody || '';

            if (fullMailBody.includes(APPROVAL_TOKEN_PLACEHOLDER)) {
                const menuMasterSid = Number(emailData.MenuMasterSid);
                const resourceSid = Number(emailData.ResourceSid);
                if (!Number.isFinite(menuMasterSid) || menuMasterSid <= 0
                    || !Number.isFinite(resourceSid) || resourceSid <= 0) {
                    throw new BadRequestException(
                        `Email body contains ${APPROVAL_TOKEN_PLACEHOLDER} but MenuMasterSid/ResourceSid is missing.`,
                    );
                }
                const issued = await this.publicAccessTokens.issueByMenuSid({
                    menuMasterSid,
                    resourceSid,
                    ttlHours: PUBLIC_QUOTATION_TOKEN_TTL_HOURS,
                    sentToEmail: typeof emailData.EmailTo === 'string' ? emailData.EmailTo : undefined,
                    createdBy: emailData.CreatedBy,
                });
                fullMailBody = fullMailBody.split(APPROVAL_TOKEN_PLACEHOLDER).join(issued.token);
            }

            const logMailBody = this.buildEmailLogBody(fullMailBody);

            const emailLog = await this._db.emailLog.create({
                data: {
                    CompanyMasterSid: emailData.CompanyMasterSid,
                    BranchMasterSid: emailData.BranchMasterSid,
                    CreatedBy: emailData.CreatedBy,
                    EmailTo : emailData.EmailTo,
                    EmailCC : emailData.EmailCC,
                    Subject : emailData.Subject,
                    Mailbody : logMailBody,
                    Status : 'A'
                }
            });

            const emailSent = await this.emailService.sendEmailWithFullContent({
                email: emailData.EmailTo,
                cc: emailData.EmailCC,
                bcc: emailData.EmailBCC,
                subject: emailData.Subject,
                html: fullMailBody,
                attachments: files || []
            });

            if (!emailSent) {
                throw new Error('Failed to send email');
            }

            return emailLog;
        } catch (error) {
            throw new Error(`Error creating emailLog: ${error.message}`);
        }
    }

    private buildEmailLogBody(mailBody: string): string {
        const plainTextBody = mailBody
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/\s+\n/g, '\n')
            .replace(/\n\s+/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();

        return plainTextBody.slice(0, 1900);
    }

}
