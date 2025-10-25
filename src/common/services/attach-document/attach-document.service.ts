import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import * as fs from 'fs';
import * as path from 'path';
import { CreateAttachDocumentDto } from 'src/common/dto/attach-document.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/email/email.service';
import * as pug from 'pug';

@Injectable()
export class AttachDocumentService {
    constructor(
        private _db: DatabaseService,
        private configService: ConfigService,
        private emailService: EmailService
    ) { }

    async createNewAttachDocumentGroup(
        files: Express.Multer.File[],
        uploadDto: any,
        menuName: string,
        user: any
    ) {
        const basePath = this.configService.get('UPLOAD_EDOC_PATH');
        const folderPath = path.join(basePath, menuName, String(uploadDto.DocumentSid));
        const savedFiles: string[] = []; // Track saved files for rollback

        try {
            // Validate required fields first
            if (!uploadDto.CompanyMasterSid || !uploadDto.BranchMasterSid || !uploadDto.MenuMasterSid || !uploadDto.DocumentSid) {
                throw new BadRequestException('Missing required fields: CompanyMasterSid, BranchMasterSid, MenuMasterSid, or DocumentSid');
            }

            // Ensure folder exists BEFORE transaction
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            // Use transaction for ALL database operations
            return await this._db.$transaction(async (tx) => {
                // 1️⃣ Create AttachDocumentGroup
                const group = await tx.attachDocumentGroup.create({
                    data: {
                        CompanyMasterSid: Number(uploadDto.CompanyMasterSid),
                        BranchMasterSid: Number(uploadDto.BranchMasterSid),
                        MenuMasterSid: Number(uploadDto.MenuMasterSid),
                        MenuName: menuName,
                        DocumentSid: Number(uploadDto.DocumentSid),
                        Remarks: uploadDto.EdocRemarks || '',
                        createdBy: uploadDto.CreatedBy || 'system',
                    },
                });

                console.log('✅ Group created:', group.AttachDocumentGroupSid);

                // 2️⃣ Create AttachDocument entries
                const createdFiles: any[] = [];

                for (const file of files) {
                    const filePath = path.join(folderPath, file.originalname);

                    // Save file to disk
                    fs.writeFileSync(filePath, file.buffer);
                    savedFiles.push(filePath); // Track for potential rollback

                    console.log('✅ File saved:', file.originalname);

                    // Create database record
                    const record = await tx.attachDocument.create({
                        data: {
                            AttachDocumentGroupSid: group.AttachDocumentGroupSid,
                            FileName: file.originalname,
                            FilePath: filePath,
                            DocumentType: uploadDto.DocumentType || path.extname(file.originalname).substring(1),
                            AttachDocmentNo: uploadDto.AttachDocmentNo || '',
                            DocumentDate: uploadDto.DocumentDate ? new Date(uploadDto.DocumentDate) : null,
                            ReceivedDate: uploadDto.ReceivedDate ? new Date(uploadDto.ReceivedDate) : null,
                            SentDate: uploadDto.SentDate ? new Date(uploadDto.SentDate) : null,
                            FollowupRequire: uploadDto.FollowupRequired || 'N',
                            FollowupDate: uploadDto.FollowupDate ? new Date(uploadDto.FollowupDate) : null,
                            Public: uploadDto.Public || 'N',
                            status: uploadDto.EdocStatus || 'A',
                            createdBy: uploadDto.CreatedBy || 'system',
                        },
                    });

                    console.log('✅ Document record created:', record.AttachDocumentSid);

                    // 3️⃣ Create followup if required
                    if (uploadDto.FollowupRequired === 'Y') {
                        const followupRes = await tx.followup.create({
                            data: {
                                CompanyMasterSid: Number(uploadDto.CompanyMasterSid),
                                BranchMasterSid: Number(uploadDto.BranchMasterSid),
                                DocumentSid: Number(uploadDto.DocumentSid),
                                AttachDocmentNo: record.AttachDocmentNo,
                                DocumentDate: record.DocumentDate,
                                FileName: record.FileName,
                                Documenttype: record.DocumentType, // Fixed: was using wrong case
                                ReceivedDate: uploadDto.ReceivedDate ? new Date(uploadDto.ReceivedDate) : null,
                                FollowupRequire: uploadDto.FollowupRequired,
                                FollowupDate: uploadDto.FollowupDate ? new Date(uploadDto.FollowupDate) : '', // Fixed: was empty string
                                FollowupAction: uploadDto.FollowupAction || '',
                                Remarks: uploadDto.FollowupRemarks || '',
                                Public: uploadDto.Public || 'N',
                                sentEmail: uploadDto.sentEmail || 'N',
                                Status: uploadDto.FollowupStatus || 'P',
                                CreatedBy: uploadDto.CreatedBy || 'system',
                            },
                        });

                        console.log('✅ Followup created:', followupRes.FollowupSid);
                    }

                    // 4️⃣ Send email if required (outside transaction to avoid blocking)
                    if (uploadDto.sentEmail === 'Y') {
                        // Queue email sending asynchronously (don't await inside transaction)
                        this.sendFollowupEmailAsync(record, uploadDto, folderPath, file).catch(err => {
                            console.error('❌ Email sending failed:', err);
                        });
                    }

                    createdFiles.push(record);
                }

                return { group, createdFiles };
            });

        } catch (error) {
            console.error('❌ Transaction failed, rolling back files:', error);

            // Rollback: Delete saved files if database transaction failed
            for (const filePath of savedFiles) {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('🗑️ Rolled back file:', filePath);
                    }
                } catch (unlinkError) {
                    console.error('Failed to delete file during rollback:', filePath, unlinkError);
                }
            }

            throw error;
        }
    }

    // Separate method for async email sending
    private async sendFollowupEmailAsync(
        record: any,
        uploadDto: any,
        folderPath: string,
        file: Express.Multer.File
    ) {
        try {
            const templatePath = path.join(process.cwd(), 'src', 'email', 'templates', 'followup-email.pug');
            const html = pug.renderFile(templatePath, {
                recipientName: 'User',
                fileName: record.FileName,
                link: '#',
                followupDate: record.FollowupDate ? new Date(record.FollowupDate).toLocaleDateString() : 'N/A',
                remarks: uploadDto.FollowupRemarks || '',
            });

            const attachmentFile = {
                filename: file.originalname,
                content: file.buffer,
                contentType: file.mimetype
            };

            await this.emailService.sendFollowupEmail({
                email: 'developer1@dofi.co',
                cc: '',
                subject: 'Follow-up Document Created',
                html,
                file: attachmentFile,
            });

            console.log('✅ Email sent successfully');
        } catch (error) {
            console.error('❌ Email sending error:', error);
            // Don't throw - email failure shouldn't break the main flow
        }
    }

    async updateAttachDocumentById(
        files: Express.Multer.File[],
        AttachDocumentSid: number,
        payload: any,
    ) {
        const UPLOAD_EDOC_PATH = this.configService.get('UPLOAD_EDOC_PATH');
        const savedFiles: string[] = [];

        try {
            return await this._db.$transaction(async (tx) => {
                // 1️⃣ Fetch existing document + group
                const exist: any = await tx.attachDocument.findUnique({
                    where: { AttachDocumentSid },
                    include: { attachGroup: true },
                });

                if (!exist) {
                    throw new BadRequestException(`Attach Document with id ${AttachDocumentSid} not found`);
                }

                console.log('✅ Found existing document:', AttachDocumentSid);

                const folderPath = path.join(
                    UPLOAD_EDOC_PATH,
                    exist.attachGroup.MenuName,
                    String(exist.attachGroup.DocumentSid)
                );

                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath, { recursive: true });
                }

                // 2️⃣ Update existing document fields
                const updatedDoc = await tx.attachDocument.update({
                    where: { AttachDocumentSid },
                    data: {
                        DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : exist.DocumentDate,
                        ReceivedDate: payload.ReceivedDate ? new Date(payload.ReceivedDate) : exist.ReceivedDate,
                        SentDate: payload.SentDate ? new Date(payload.SentDate) : exist.SentDate,
                        FollowupRequire: payload.FollowupRequired || exist.FollowupRequire,
                        FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : exist.FollowupDate,
                        updatedBy: payload.updatedBy || 'system',
                        updatedOn: new Date(),
                    },
                });

                console.log('✅ Document updated:', AttachDocumentSid);

                // 3️⃣ Save new files if uploaded, without duplicates
                if (files && files.length > 0) {
                    for (const file of files) {
                        const filePath = path.join(folderPath, file.originalname);
                        const existingFile = await tx.attachDocument.findFirst({
                            where: {
                                FileName: file.originalname,
                                AttachDocumentGroupSid: exist.AttachDocumentGroupSid
                            },
                        });

                        if (!existingFile) {
                            fs.writeFileSync(filePath, file.buffer);
                            savedFiles.push(filePath);

                            await tx.attachDocument.create({
                                data: {
                                    AttachDocumentGroupSid: exist.AttachDocumentGroupSid,
                                    FileName: file.originalname,
                                    FilePath: filePath,
                                    DocumentType: path.extname(file.originalname).substring(1),
                                    AttachDocmentNo: exist.AttachDocmentNo,
                                    DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : exist.DocumentDate,
                                    ReceivedDate: payload.ReceivedDate ? new Date(payload.ReceivedDate) : exist.ReceivedDate,
                                    SentDate: payload.SentDate ? new Date(payload.SentDate) : exist.SentDate,
                                    FollowupRequire: payload.FollowupRequired || exist.FollowupRequire,
                                    FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : exist.FollowupDate,
                                    Public: payload.Public || exist.Public,
                                    status: 'A',
                                    createdBy: payload.updatedBy || 'system',
                                },
                            });

                            console.log('✅ New file added:', file.originalname);
                        } else {
                            console.log('⚠️ File already exists, skipping:', file.originalname);
                        }
                    }
                }

                // 4️⃣ Follow-up logic
                if (payload.FollowupRequired === 'Y') {
                    const existingFollowup = await tx.followup.findFirst({
                        where: { AttachDocmentNo: exist.AttachDocmentNo },
                    });

                    if (existingFollowup) {
                        await tx.followup.update({
                            where: { FollowupSid: existingFollowup.FollowupSid },
                            data: {
                                FollowupAction: payload.FollowupAction || existingFollowup.FollowupAction,
                                FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : existingFollowup.FollowupDate,
                                Remarks: payload.FollowupRemarks || existingFollowup.Remarks,
                                Public: payload.Public || existingFollowup.Public || 'N',
                                sentEmail: payload.sentEmail || existingFollowup.sentEmail || 'N',
                                Status: payload.FollowupStatus || existingFollowup.Status,
                                UpdatedBy: payload.updatedBy || 'system',
                                UpdatedOn: new Date(),
                            },
                        });

                        console.log('✅ Followup updated:', existingFollowup.FollowupSid);
                    } else {
                        await tx.followup.create({
                            data: {
                                CompanyMasterSid: exist.attachGroup.CompanyMasterSid,
                                BranchMasterSid: exist.attachGroup.BranchMasterSid,
                                DocumentSid: exist.attachGroup.DocumentSid,
                                AttachDocmentNo: exist.AttachDocmentNo,
                                DocumentDate: exist.DocumentDate,
                                FileName: exist.FileName,
                                Documenttype: exist.DocumentType,
                                ReceivedDate: exist.ReceivedDate,
                                FollowupRequire: 'Y',
                                FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : '',
                                FollowupAction: payload.FollowupAction || '',
                                Remarks: payload.FollowupRemarks || '',
                                Public: payload.Public || 'N',
                                sentEmail: payload.sentEmail || 'N',
                                Status: payload.FollowupStatus || 'P',
                                CreatedBy: payload.updatedBy || 'system',
                            },
                        });

                        console.log('✅ Followup created');
                    }
                } else if (payload.FollowupRequired === 'N') {
                    await tx.followup.updateMany({
                        where: { AttachDocmentNo: exist.AttachDocmentNo },
                        data: { Status: 'S' },
                    });

                    console.log('✅ Followup marked as skipped');
                }

                // 5️⃣ Email sending (async, outside transaction)
                if (payload.sentEmail === 'Y') {
                    this.sendUpdateEmailAsync(updatedDoc, payload, folderPath, files, exist).catch(err => {
                        console.error('❌ Email sending failed:', err);
                    });
                }

                return { message: 'Document updated successfully', data: updatedDoc };
            });

        } catch (error) {
            console.error('❌ Update transaction failed, rolling back files:', error);

            // Rollback newly saved files
            for (const filePath of savedFiles) {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('🗑️ Rolled back file:', filePath);
                    }
                } catch (unlinkError) {
                    console.error('Failed to delete file during rollback:', filePath, unlinkError);
                }
            }

            throw error;
        }
    }

    private async sendUpdateEmailAsync(
        updatedDoc: any,
        payload: any,
        folderPath: string,
        files: Express.Multer.File[],
        exist: any
    ) {
        try {
            const templatePath = path.join(process.cwd(), 'src', 'email', 'templates', 'followup-email.pug');
            const html = pug.renderFile(templatePath, {
                recipientName: 'User',
                fileName: updatedDoc.FileName,
                link: '#',
                followupDate: payload.FollowupDate ? new Date(payload.FollowupDate).toLocaleDateString() : 'N/A',
                remarks: payload.FollowupRemarks || '',
            });

            const attachmentFile = files && files.length > 0
                ? { filename: files[0].originalname, content: files[0].buffer, contentType: files[0].mimetype }
                : { filename: exist.FileName, content: fs.readFileSync(path.join(folderPath, exist.FileName)), contentType: 'application/octet-stream' };

            await this.emailService.sendFollowupEmail({
                email: 'developer1@dofi.co',
                cc: '',
                subject: payload.emailSubject || 'Follow-up Document Updated',
                html,
                file: attachmentFile,
            });

            console.log('✅ Update email sent successfully');
        } catch (error) {
            console.error('❌ Update email sending error:', error);
        }
    }


    //get
    async fetchAttachDocumentByFolder(menuMasterSid: number, documentSid: number) {
        const UPLOAD_EDOC_PATH = this.configService.get("UPLOAD_EDOC_PATH");
        try {
            // 1️⃣ Get Menu Name
            const menu = await this._db.menuMaster.findUnique({
                where: { MenuMasterSid: Number(menuMasterSid) },
                select: { MenuName: true },
            });
            if (!menu) throw new BadRequestException(`MenuMaster not found for ID ${menuMasterSid}`);

            const folderPath = path.join(UPLOAD_EDOC_PATH, menu.MenuName, String(documentSid));
            if (!fs.existsSync(folderPath)) throw new BadRequestException(`Folder not found: ${folderPath}`);

            // 2️⃣ Find group and related files
            const group = await this._db.attachDocumentGroup.findFirst({
                where: { MenuMasterSid: Number(menuMasterSid), DocumentSid: documentSid },
                include: {
                    attachFiles: true, // includes all related files
                },
            });

            if (!group) {
                throw new Error("Document group not found");
            }

            // Extract all AttachDocumentSids
            const attachDocSids:any = group.attachFiles.map(file => file.AttachDocmentNo);

            const followups = await this._db.followup.findMany({
                where: {
                    AttachDocmentNo: { in: attachDocSids },
                    DocumentSid: documentSid,
                },
            });


            if (!group) throw new BadRequestException(`No AttachDocumentGroup found for MenuMasterSid: ${menuMasterSid}, DocumentSid: ${documentSid}`);
            if (!group.attachFiles || group.attachFiles.length === 0) {
                throw new BadRequestException(`No attached files found for this group`);
            }

            // 3️⃣ Optionally, read actual folder contents to verify physical files
            const filesOnDisk = fs.readdirSync(folderPath);

            return {
                group,
                followups,
                filesOnDisk,
            };
        } catch (error) {
            throw error;
        }
    }



    //download

    async downloadFileByName(menuMasterSid: number, documentSid: number, fileName: string) {
        const UPLOAD_EDOC_PATH = this.configService.get("UPLOAD_EDOC_PATH");

        try {
            // Get menu name
            const menu = await this._db.menuMaster.findUnique({
                where: { MenuMasterSid: Number(menuMasterSid) },
                select: { MenuName: true },
            });

            if (!menu) {
                throw new BadRequestException(`MenuMaster not found for ID ${menuMasterSid}`);
            }

            const filePath = path.join(UPLOAD_EDOC_PATH, menu.MenuName, String(documentSid), fileName);

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new BadRequestException(`File not found: ${fileName}`);
            }

            // Return file buffer and metadata
            return {
                buffer: fs.readFileSync(filePath),
                fileName: fileName,
                mimeType: this.getMimeType(fileName),
            };
        } catch (error) {
            console.error('❌ File download error:', error);
            throw error;
        }
    }

    // Helper to get MIME type
    private getMimeType(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.txt': 'text/plain',
            '.zip': 'application/zip',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    async deleteAttachDocumentFile(attachDocumentSid: number) {
        const UPLOAD_EDOC_PATH = this.configService.get("UPLOAD_EDOC_PATH");

        try {
            // Get file info before deleting
            const file = await this._db.attachDocument.findUnique({
                where: { AttachDocumentSid: attachDocumentSid },
                include: { attachGroup: true },
            });

            if (!file) {
                throw new BadRequestException(`File not found with id: ${attachDocumentSid}`);
            }

            // Delete from database
            await this._db.attachDocument.delete({
                where: { AttachDocumentSid: attachDocumentSid },
            });

            // Delete physical file
            if (fs.existsSync(file.FilePath)) {
                fs.unlinkSync(file.FilePath);
                console.log('🗑️ Physical file deleted:', file.FilePath);
            }

            // Check if group has no more files, delete group too
            const remainingFiles = await this._db.attachDocument.count({
                where: { AttachDocumentGroupSid: file.AttachDocumentGroupSid },
            });

            if (remainingFiles === 0) {
                await this._db.attachDocumentGroup.delete({
                    where: { AttachDocumentGroupSid: file.AttachDocumentGroupSid },
                });
                console.log('🗑️ Empty group deleted:', file.AttachDocumentGroupSid);
            }

            return { message: 'File deleted successfully', deletedFile: file.FileName };
        } catch (error) {
            console.error('❌ Delete error:', error);
            throw error;
        }
    }

    // async getAllAttachDocuments() {
    //     try {
    //         const allAttachDocuments = await this._db.attachDocumentGroup.findMany({
    //             where: {
    //                 status: 'A'
    //             },
    //             include: {
    //                 companyMaster: true,
    //                 branchMaster: true,
    //                 attachFiles:true
    //             }
    //         });
    //         return allAttachDocuments;
    //     } catch (error) {
    //         throw error;
    //     }
    // }

    // async fetchAttachDocumentById(AttachDocumentGroupSid: number) {
    //         try {
    //             const attachDocument = await this._db.attachDocumentGroup.findMany({
    //                 where: {
    //                     AttachDocumentGroupSid: AttachDocumentGroupSid,
    //                 },
    //                 include: {
    //                     companyMaster: true,
    //                     branchMaster: true,
    //                     attachFiles:true
    //                 }
    //             });
    //             if (!attachDocument) {
    //                 throw new BadRequestException(`Attach Document with Id : ${AttachDocumentGroupSid} not exists`);
    //             }
    //             return attachDocument;
    //         } catch (error) {
    //             throw error;
    //         }
    //     }


    // async deleteAttachDocument(AttachDocumentGroupSid: number) {
    //     try {
    //         const exist = await this._db.attachDocumentGroup.findUnique({
    //             where: {
    //                 AttachDocumentGroupSid: AttachDocumentGroupSid
    //             }
    //         });
    //         if (!exist) {
    //             throw new BadRequestException(`Attach Document with Id : ${AttachDocumentGroupSid} not exists`);
    //         }
    //         if (exist.status === 'D') {
    //             throw new BadRequestException(`Attach Document with Id :${AttachDocumentGroupSid} is already deleted`);
    //         }
    //         const deletedAttachDocument = await this._db.attachDocumentGroup.update({
    //             where: {
    //                 AttachDocumentGroupSid: AttachDocumentGroupSid
    //             },
    //             data: {
    //                 status: 'D'
    //             },
    //             include: {
    //                 companyMaster: true,
    //                 branchMaster: true
    //             }
    //         });
    //         return deletedAttachDocument;
    //     } catch (error) {
    //         throw error;
    //     }
    // }

    // async searchAttachDocument(data: SearchListDto) {
    //     const { searchType, filterValue } = data;
    //     const intFields = [
    //         'AttachDocumentSid',
    //         'CompanyMasterSid',
    //         'BranchMasterSid',
    //         'DocumentSid'
    //     ];
    //     const stringFields = [
    //         'AttachDocmentNo',
    //         'FileName',
    //         'Documenttype',
    //         'FollowupRequire',
    //         'Public',
    //         'createdBy',
    //         'updatedBy',
    //         'status',
    //         'Remarks'
    //     ];
    //     const dateFields = [
    //         'DocumentDate',
    //         'ReceivedDate',
    //         'FollowupDate'
    //     ];
    //     const acceptedType = [...intFields, ...stringFields, ...dateFields];
    //     if (!acceptedType.includes(searchType)) {
    //         throw new BadRequestException('Invalid Search Type');
    //     }

    //     const whereClause: any = {};

    //     if (stringFields.includes(searchType)) {
    //         whereClause[searchType] = {
    //             contains: filterValue,
    //             mode: 'insensitive'
    //         };
    //     } else if (intFields.includes(searchType)) {
    //         const numberValue = parseInt(filterValue);
    //         if (isNaN(numberValue)) {
    //             throw new BadRequestException(`${searchType} must be a valid number`);
    //         }
    //         whereClause[searchType] = numberValue;
    //     } else if (dateFields.includes(searchType)) {
    //         const dateValue = new Date(filterValue);
    //         if (isNaN(dateValue.getTime())) {
    //             throw new BadRequestException(`${searchType} must be a valid date`);
    //         }
    //         whereClause[searchType] = dateValue;
    //     }

    //     const searchResults = await this._db.attachDocument.findMany({
    //         where: {
    //             ...whereClause,
    //             status: 'A'
    //         },
    //         include: {
    //             companyMaster: true,
    //             branchMaster: true
    //         }
    //     }).catch((err) => {
    //         throw new Error(`Error Occurred : ${JSON.stringify(err)}`);
    //     });

    //     return searchResults;
    // }


}