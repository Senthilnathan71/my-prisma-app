import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import * as moment from 'moment-timezone';

@Injectable()
export class FollowupService {

    constructor(
        private _db: DatabaseService, 
        private emailService: EmailService, 
        private logger: Logger,
        private schedulerService : SchedulerService
    ) { }

    async createFollowup(payload: any,user) {

        try {
            const { followupCreate, mailContent, createdBy, updatedBy } = payload;
            const followupDate = followupCreate.FollowupDate;
            console.log(followupDate); 

            const correctedDate = moment(followupDate)
                .add(1, "day")
                .startOf("day")
                .toDate();

            console.log(correctedDate);

            const followup = await this._db.followup.create({
                data: {
                    ...followupCreate,
                    FollowupDate: correctedDate,
                    FollowupRequire: followupCreate.FollowupRequire ? 'Y' : 'N',
                    Public: followupCreate.Public ? 'Y' : 'N',
                    sentEmail: followupCreate.sentEmail ? 'Y' : 'N',
                    CreatedBy: createdBy,
                    UpdatedBy: updatedBy,
                }
            }); 
            if (followupCreate.sentEmail && followup.Status === "A" && mailContent) {
                await this.sendSpecificFollowupEmail(followup.FollowupSid, mailContent)
                await this.scheduleFollowupEmail(followup.FollowupSid, followupCreate.FollowupDate, mailContent);
            }

            return followup;
        } catch (error) {
            this.logger.error(`Error in createFollowup: ${error.message}`);
            throw new Error(`Failed to create followup: ${error.message}`);
        }
    }

    async scheduleFollowupEmail(followupId: number, followupDate: Date, mailContent: any) {
        const jobName = `followup-${followupId}`;

        const followupDateTime = new Date(followupDate);
        const cronExpression = `${followupDateTime.getMinutes()} ${followupDateTime.getHours()} ${followupDateTime.getDate()} ${followupDateTime.getMonth() + 1} *`;


        this.schedulerService.addCronJob(
            jobName,
            cronExpression,
            async () => {
                await this.sendSpecificFollowupEmail(followupId, mailContent);
                this.schedulerService.removeCronJob(jobName);
            }
        );

        this.logger.log(`Scheduled email job for followup ${followupId} at ${followupDate}`);
    }

    async sendSpecificFollowupEmail(followupId: number, mailContent: any) {
        try {
            const followup = await this._db.followup.findUnique({
                where: { FollowupSid: followupId }
            });

            if(!followup) {
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

    async updateFollowup(followupMasterSid: number, payload: any, user) {
        const existing = await this._db.followup.findUnique({
            where: {
                FollowupSid: followupMasterSid
            }
        });

        if (!existing) {
            throw new Error('followup does not exists');
        }

        try{
            const followup = await this._db.followup.update({
                where: {
                    FollowupSid: followupMasterSid
                }, data: payload
            });
            return followup;
        } catch (error) {
            throw new Error(`Error updating: ${error.message}`);
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
