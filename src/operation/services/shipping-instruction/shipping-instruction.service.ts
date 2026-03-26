import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class ShippingInstructionService {
    constructor(
        private readonly _db: DatabaseService,
        private readonly logger: Logger,
        private readonly jwtService: JwtService,
        private readonly emailService: EmailService
    ) { }

    async createShippingInstruction(payload: {
        CompanyMasterSid: number;
        BranchMasterSid: number;
        HouseJobSid: number;
        Remarks?: string;
        CreatedBy: string;
        SIStatus?: string;
    }) {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                // 1. Upsert ShippingInstruction — create if none exists for this HouseJobSid, update if exists
                const existing = await prisma.shippingInstruction.findFirst({
                    where: {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        HouseJobSid: payload.HouseJobSid,
                        Status: 'A'
                    }
                });

                let shippingInstruction;
                if (existing) {
                    shippingInstruction = await prisma.shippingInstruction.update({
                        where: {
                            ShippingInstructionSid: existing.ShippingInstructionSid
                        },
                        data: {
                            Remarks: payload.Remarks || '',
                            SIStatus: payload.SIStatus || 'Confirmed',
                            UpdatedBy: payload.CreatedBy,
                            UpdatedOn: new Date()
                        }
                    });
                } else {
                    // Soft-delete any old records for this HouseJobSid before creating new one
                    await prisma.shippingInstruction.updateMany({
                        where: {
                            HouseJobSid: payload.HouseJobSid,
                            Status: 'A'
                        },
                        data: {
                            Status: 'D',
                            UpdatedBy: payload.CreatedBy,
                            UpdatedOn: new Date()
                        }
                    });

                    shippingInstruction = await prisma.shippingInstruction.create({
                        data: {
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            HouseJobSid: payload.HouseJobSid,
                            Remarks: payload.Remarks || '',
                            SIStatus: payload.SIStatus || 'Confirmed',
                            CreatedBy: payload.CreatedBy
                        }
                    });
                }

                // 2. Update HouseJobOthers to set SIConfirmationDate
                await prisma.houseJobOthers.updateMany({
                    where: {
                        HouseJobSid: payload.HouseJobSid,
                        status: 'A'
                    },
                    data: {
                        SIConfirmationDate: new Date()
                    }
                });

                return shippingInstruction;
            });

            return result;
        } catch (error) {
            this.logger.error(`Failed to create shipping instruction: ${error.message}`);
            throw error;
        }
    }

    async sendSIMail(payload: {
        CompanyMasterSid: number;
        BranchMasterSid: number;
        HouseJobSid: number;
        appBaseUrl: string;
        userEmail?: string;
        userName?: string;
    }) {
        try {
            // 1. Fetch MailConfigurationMaster for SendSIMail action
            const mailConfig = await this._db.mailConfigurationMaster.findFirst({
                where: {
                    Action: { contains: 'SendSIMail' },
                    CompanyMasterSid: payload.CompanyMasterSid,
                    Status: 'A'
                }
            });

            if (!mailConfig) {
                throw new BadRequestException('Mail configuration not found for SI Mail');
            }

            // 2. Fetch house job data for placeholders and recipient resolution
            const houseJob = await this._db.houseJob.findFirst({
                where: {
                    HouseJobSid: payload.HouseJobSid,
                    status: 'A'
                },
                include: {
                    Cargo: { where: { status: 'A' } },
                    Products: { where: { status: 'A' } },
                    Others: { where: { status: 'A' } },
                    Connections: { where: { status: 'A' } }
                }
            });

            if (!houseJob) {
                throw new BadRequestException('House Job not found');
            }

            // 3. Generate JWT token (expires in 7 days)
            const token = this.jwtService.sign(
                {
                    HouseJobSid: payload.HouseJobSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    type: 'si-public'
                },
                { expiresIn: '7d' }
            );

            // 4. Build the SI URL
            const siUrl = `${payload.appBaseUrl}/public/shipment-instruction?token=${token}`;

            // 5. Resolve menuEmail from CustomerBrEmail
            let menuEmail = '';
            if (houseJob.CustomerBranchSid) {
                const brEmail = await this._db.customerBrEmail.findFirst({
                    where: {
                        CustomerBranchSid: houseJob.CustomerBranchSid,
                        status: 'A'
                    }
                });
                menuEmail = brEmail?.Toemail || '';
            }
            if (!menuEmail && houseJob.CustomerMasterSid) {
                const brEmail = await this._db.customerBrEmail.findFirst({
                    where: {
                        CustomerMasterSid: houseJob.CustomerMasterSid,
                        status: 'A'
                    }
                });
                menuEmail = brEmail?.Toemail || '';
            }
            if (!menuEmail) {
                throw new BadRequestException('To email is not available. Please configure in Customer Branch Email.');
            }

            // 6. Build placeholder context (matches frontend EmailTriggerService pattern)
            const placeholderContext: { [key: string]: string } = {
                menuEmail: menuEmail,
                organizationEmail: menuEmail,
                userEmail: payload.userEmail || '',
                userName: payload.userName || '',
                customerName: houseJob.CustomerName || '',
                ShipmentNo: houseJob.ShipmentNo || '',
                shipperName: houseJob.ShipperName || '',
                consigneeName: houseJob.ConsigneeName || '',
                date: new Date().toLocaleDateString(),
                POO: houseJob.POO || '',
                POL: houseJob.POL || '',
                POD: houseJob.POD || '',
                FPD: houseJob.FPD || '',
                approvalLink: siUrl,
                SI_LINK: siUrl,
                HBL_NO: houseJob.HBLNo || '',
            };

            // 7. Resolve all placeholders in all fields
            const toEmail = this.replacePlaceholders(mailConfig.ToEmailidFrom || '', placeholderContext);
            const ccEmail = this.replacePlaceholders(mailConfig.CcEmailidFrom || '', placeholderContext);
            const subject = this.replacePlaceholders(mailConfig.MailSubject || '', placeholderContext);
            let body = this.replacePlaceholders(mailConfig.MailBody || '', placeholderContext);

            // Convert plain text newlines to HTML <br> for email rendering
            body = body.replace(/\n/g, '<br>');

            if (!toEmail) {
                throw new BadRequestException('Recipient email not found. Please check customer email and mail configuration.');
            }

            // 8. Check Trigger/AutoPopup — if Popup, return data for frontend to show popup
            if (mailConfig.AutoPopup === 'P') {
                return {
                    emailSent: false,
                    showPopup: true,
                    emailData: {
                        toEmail,
                        ccEmail,
                        subject,
                        body
                    }
                };
            }

            // 9. Auto send email
            await this.emailService.sendEmail({
                email: toEmail,
                cc: ccEmail || undefined,
                subject: subject,
                html: body
            });

            return { emailSent: true, showPopup: false };
        } catch (error) {
            this.logger.error(`Failed to send SI mail: ${error.message}`);
            throw error;
        }
    }

    private replacePlaceholders(text: string, context: { [key: string]: string }): string {
        if (!text || !context) return text || '';
        let result = text;
        for (const key in context) {
            if (context.hasOwnProperty(key)) {
                result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), context[key] ?? '');
            }
        }
        return result;
    }

    async getHouseJobBySid(HouseJobSid: number) {
        const houseJob = await this._db.houseJob.findFirst({
            where: {
                HouseJobSid: HouseJobSid,
                status: 'A'
            },
            include: {
                Cargo: { where: { status: 'A' } },
                Products: { where: { status: 'A' } },
                Others: { where: { status: 'A' } },
                Connections: { where: { status: 'A' } }
            }
        });

        if (!houseJob) {
            throw new BadRequestException('House Job not found');
        }

        // Enrich with voyage details if available
        let voyageDetails = {};
        if (houseJob.VoyageMasterSid) {
            const data = await this._db.voyageMasterHeader.findUnique({
                where: {
                    VoyageMasterHeaderSid: houseJob.VoyageMasterSid
                },
                include: {
                    voyageMasterDetail: {
                        where: { status: 'A' },
                        select: {
                            ETA: true,
                            ETD: true,
                            PortCutoff: true,
                            portMasterPOL: {
                                select: { PortCode: true }
                            }
                        }
                    }
                }
            });
            const POL = data?.voyageMasterDetail.find(vd => vd.portMasterPOL?.PortCode === houseJob.POL);
            const POD = data?.voyageMasterDetail.find(vd => vd.portMasterPOL?.PortCode === houseJob.POD);
            voyageDetails = {
                POLETA: POL?.ETA,
                POLETD: POL?.ETD,
                PODETA: POD?.ETA,
                PODETD: POD?.ETD,
                POLCutOffDate: POL?.PortCutoff,
                PODCutOffDate: POD?.PortCutoff
            };
        }

        // Fetch SIStatus from ShippingInstruction
        const si = await this._db.shippingInstruction.findFirst({
            where: { HouseJobSid, Status: 'A' },
            select: { SIStatus: true }
        });

        return { ...houseJob, voyageDetails, SIStatus: si?.SIStatus || null };
    }
}
