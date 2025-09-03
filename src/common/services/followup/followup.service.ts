import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class FollowupService {
    constructor(private _db: DatabaseService, private emailService: EmailService, private logger: Logger) { }

    async createFollowup(payload: any,user) {
        this.logger.warn(`createFollowup: ${payload}`);

        try {
            const { followupCreate, mailContent, createdBy, updatedBy } = payload;
            const followup = await this._db.followup.create({
                data: {
                    ...followupCreate,
                     FollowupRequire: followupCreate.FollowupRequire ? 'Y' : 'N', // converts true → "true"
                     Public: followupCreate.Public ? 'Y' : 'N',
                     sentEmail: followupCreate.sentEmail ? 'Y' : 'N',
                    CreatedBy: createdBy,   
                    UpdatedBy: updatedBy,
                }
            }); 
            const emailSent = await this.emailService.sendFollowupEmail({
                email: mailContent.EmailTo,
                cc: mailContent.EmailCC,
                subject: mailContent.Subject,
                html: mailContent.Mailbody
            })

            if(!emailSent) {
                this.logger.warn(`Failed to send followup email`);
                throw new Error('Failed to send followup email');
            }

            return followup;
        } catch (error) {
            this.logger.error(`Error in createFollowup: ${error.message}`);
            throw new Error(`Failed to create followup: ${error.message}`);
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
