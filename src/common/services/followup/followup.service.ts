import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import * as moment from 'moment-timezone';

@Injectable()
export class FollowupService implements OnModuleInit {

    constructor(
        private _db: DatabaseService,
        private emailService: EmailService,
        private logger: Logger,
        private schedulerService : SchedulerService
    ) { }

    async onModuleInit() {
        await this.rescheduleUnfinishedFollowupEmails();
    }

    private async rescheduleUnfinishedFollowupEmails() {
        try {
            const pending = await this._db.followup.findMany({
                where: {
                    sentEmail: 'Y',
                    Status: 'A',
                    ReceivedDate: null,
                    FollowupDate: { gt: new Date() },
                },
            });

            for (const followup of pending) {
                let emailTo = '';
                if (followup.InternalUser) {
                    const user = await this._db.userMaster.findUnique({
                        where: { UserMasterSid: followup.InternalUser },
                        select: { userEmail: true },
                    });
                    emailTo = user?.userEmail || '';
                } else if (followup.ExternalUser) {
                    emailTo = followup.ExternalUser;
                }

                const mailContent = {
                    EmailTo: emailTo,
                    EmailCC: '',
                    Subject: followup.Subject || 'Follow Up Reminder',
                    Mailbody: followup.Remarks || '',
                };

                await this.scheduleFollowupEmail(followup.FollowupSid, followup.FollowupDate, mailContent);
            }

            this.logger.log(`Rescheduled ${pending.length} pending followup email job(s) on startup`);
        } catch (error) {
            this.logger.error(`Failed to reschedule followup emails on startup: ${error.message}`);
        }
    }

    async createFollowup(payload: any, user) {

        try {
            const { followupCreate, mailContent, createdBy, updatedBy } = payload;

            const followup = await this._db.followup.create({
                data: {
                    ...followupCreate,
                    MenuMasterSid: followupCreate.MenuMasterSid != null ? Number(followupCreate.MenuMasterSid) : null,
                    CompanyMasterSid: Number(followupCreate.CompanyMasterSid),
                    BranchMasterSid: Number(followupCreate.BranchMasterSid),
                    DocumentSid: followupCreate.DocumentSid != null ? Number(followupCreate.DocumentSid) : null,
                    InternalUser: followupCreate.InternalUser != null ? Number(followupCreate.InternalUser) : null,
                    FollowupDate: followupCreate.FollowupDate,
                    FollowupRequire: followupCreate.FollowupRequire ? 'Y' : 'N',
                    Public: followupCreate.Public ? 'Y' : 'N',
                    sentEmail: followupCreate.sentEmail ? 'Y' : 'N',
                    CreatedBy: createdBy,
                    UpdatedBy: updatedBy,
                }
            });
            if (followupCreate.sentEmail && followup.Status === "A" && mailContent) {
                await this.sendSpecificFollowupEmail(followup.FollowupSid, mailContent);
                await this.scheduleFollowupEmail(followup.FollowupSid, followup.FollowupDate, mailContent);
            }

            return followup;
        } catch (error) {
            this.logger.error(`Error in createFollowup: ${error.message}`);
            throw new Error(`Failed to create followup: ${error.message}`);
        }
    }

    async scheduleFollowupEmail(followupId: number, followupDate: Date, mailContent: any) {
        const jobName = `followup-${followupId}`;

        const followupDateTime = followupDate;
        const cronExpression = `${followupDateTime.getUTCMinutes()} ${followupDateTime.getUTCHours()} ${followupDateTime.getUTCDate()} ${followupDateTime.getUTCMonth() + 1} *`;

        this.schedulerService.addCronJob(
            jobName,
            cronExpression,
            async () => {
                await this.sendSpecificFollowupEmail(followupId, mailContent);
                this.schedulerService.removeCronJob(jobName);
            },
            'UTC'
        );

        this.logger.log(`Scheduled email job for followup ${followupId} at ${followupDate}`);
    }

    async sendSpecificFollowupEmail(followupId: number, mailContent: any) {
        try {
            const followup = await this._db.followup.findUnique({
                where: { FollowupSid: followupId }
            });

            if (!followup) {
                throw new BadRequestException('Followup not found');
            }

            if (followup.ReceivedDate) {
                throw new BadRequestException('Followup already sent');
            }

            const emailSent = await this.emailService.sendFollowupEmail({
                email: mailContent.EmailTo,
                cc: mailContent.EmailCC,
                subject: mailContent.Subject,
                html: mailContent.Mailbody
            });

            if (emailSent) {
                await this._db.followup.update({
                    where: { FollowupSid: followupId },
                    data: {
                        ReceivedDate: new Date(),
                        UpdatedOn: new Date(),
                    }
                });

                this.logger.log(`Email sent successfully for followup ${followupId}`);
            }

        } catch (error) {
            this.logger.error(`Error sending email for followup ${followupId}: ${error.message}`);
        }
    }

    async removeFollowupJob(followupId: number) {
        const jobName = `followup-${followupId}`;
        return this.schedulerService.removeCronJob(jobName);
    }

    async checkForFollowup(payload: any) {
        try {
            const today = moment()
                .add(1, "day")
                .startOf("day")
                .toDate();

            console.log(today);
            const followupList = await this._db.followup.findMany({
                where: {
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    FollowupRequire: 'Y',
                    FollowupDate: { equals: today },
                    Status: 'A'
                },
                select : {
                    FollowupAction : true,
                    Remarks : true,
                }
            })
            return followupList;
        } catch (error) {
            throw error;
        }
    }

    async getAllFollowups() {
        try {
            const followupList = await this._db.followup.findMany({
                where: {
                    Status: 'A'
                }
            })
            return followupList;
        } catch (error) {
            throw error
        }
    }

    async findOne(followupMasterSid: any) {
        try {
            return await this._db.followup.findUnique({
                where : {
                    FollowupSid: followupMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }

    async getFollowupsByDocumentId(documentSid: number, menuMasterSid?: number) {
        try {
            const followups = await this._db.followup.findMany({
                where: {
                    DocumentSid: documentSid,
                    Status: { in: ['A', 'S'] },
                    ...(menuMasterSid ? { MenuMasterSid: menuMasterSid } : {})
                },
                orderBy: { CreatedOn: 'desc' }
            });
            return followups;
        } catch (error) {
            this.logger.error(`Error fetching followups by document ID: ${error.message}`);
            throw error;
        }
    }

    async markFollowupCompleted(id: number, documentSid: number, menuMasterSid: number, isCompleted: string, updatedBy: string) {
        return this._db.followup.updateMany({
            where: { FollowupSid: id, DocumentSid: documentSid, MenuMasterSid: menuMasterSid },
            data: { IsCompleted: isCompleted, UpdatedBy: updatedBy, UpdatedOn: new Date() }
        });
    }

    async updateFollowup(followupMasterSid: number, payload: any, user) {
        const { followupCreate, mailContent, updatedBy } = payload;

        const existing = await this._db.followup.findFirst({
            where: {
                FollowupSid: followupMasterSid,
                ...(followupCreate.DocumentSid ? { DocumentSid: followupCreate.DocumentSid } : {}),
                ...(followupCreate.MenuMasterSid ? { MenuMasterSid: followupCreate.MenuMasterSid } : {}),
            }
        });

        if (!existing) {
            throw new NotFoundException('Followup does not exist');
        }

        try {
            const followup = await this._db.followup.update({
                where: { FollowupSid: followupMasterSid },
                data: {
                    ...followupCreate,
                    FollowupDate: new Date(followupCreate.FollowupDate),
                    FollowupRequire: followupCreate.FollowupRequire ? 'Y' : 'N',
                    Public: followupCreate.Public ? 'Y' : 'N',
                    sentEmail: followupCreate.sentEmail ? 'Y' : 'N',
                    UpdatedBy: updatedBy,
                    UpdatedOn: new Date()
                }
            });

            // Only send if not already sent
            if (
                followupCreate.sentEmail &&
                followup.Status === 'A' &&
                mailContent &&
                !existing.ReceivedDate
            ) {
                await this.sendSpecificFollowupEmail(followup.FollowupSid, mailContent);
                await this.scheduleFollowupEmail(followup.FollowupSid, followup.FollowupDate, mailContent);
            }

            return followup;

        } catch (error) {
            this.logger.error(`Error updating followup: ${error.message}`);
            throw new BadRequestException(error.message);
        }
    }

    async softDelete(id: number) {
        const existingfollowup = await this._db.followup.findUnique({
            where: {
                FollowupSid: id
            }
        });

        if (!existingfollowup) {
            throw new NotFoundException(`followup with ID ${id} not found`);
        }

        if (existingfollowup.Status === 'D') {
            throw new Error(`followup with ID ${id} already deleted`);
        }

        return this._db.followup.update({
            where: {
                FollowupSid: id
            },
            data: {
                Status: 'D'
            }
        });
    }

}
