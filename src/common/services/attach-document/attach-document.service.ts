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
        const savedFiles: string[] = [];

        // Validate required fields first
        if (!uploadDto.CompanyMasterSid || !uploadDto.BranchMasterSid || !uploadDto.MenuMasterSid || !uploadDto.DocumentSid) {
            throw new BadRequestException('Missing required fields: CompanyMasterSid, BranchMasterSid, MenuMasterSid, or DocumentSid');
        }

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        // Write files to disk BEFORE opening the transaction so disk I/O never holds a DB lock
        try {
            for (const file of files) {
                const filePath = path.join(folderPath, file.originalname);
                fs.writeFileSync(filePath, file.buffer);
                savedFiles.push(filePath);
                console.log('✅ File saved:', file.originalname);
            }
        } catch (error) {
            for (const filePath of savedFiles) {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (unlinkError) {
                    console.error('Failed to delete file during rollback:', filePath, unlinkError);
                }
            }
            throw error;
        }

        // Transaction contains only fast DB writes — no I/O
        try {
            return await this._db.$transaction(async (tx) => {
                // 1️⃣ Create AttachDocumentGroup
                let group = await tx.attachDocumentGroup.findFirst({
                    where: {
                        MenuMasterSid: Number(uploadDto.MenuMasterSid),
                        DocumentSid: Number(uploadDto.DocumentSid),
                    },
                });

                if (group) {
                    group = await tx.attachDocumentGroup.update({
                        where: { AttachDocumentGroupSid: group.AttachDocumentGroupSid },
                        data: {
                            Remarks: uploadDto.EdocRemarks || group.Remarks || '',
                            updatedBy: uploadDto.CreatedBy || 'system',
                            updatedOn: new Date(),
                        },
                    });
                } else {
                    group = await tx.attachDocumentGroup.create({
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
                }

                console.log('✅ Group created:', group.AttachDocumentGroupSid);

                // 2️⃣ Create AttachDocument entries
                const createdFiles: any[] = [];

                for (const file of files) {
                    const filePath = path.join(folderPath, file.originalname);

                    const duplicateFile = await tx.attachDocument.findFirst({
                        where: {
                            AttachDocumentGroupSid: group.AttachDocumentGroupSid,
                            FileName: file.originalname,
                            status: { in: ['A', 'S'] },
                        },
                    });

                    if (duplicateFile) {
                        createdFiles.push(duplicateFile);
                        continue;
                    }

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
                                MenuMasterSid: Number(uploadDto.MenuMasterSid),
                                DocumentSid: Number(uploadDto.DocumentSid),
                                AttachDocmentNo: record.AttachDocmentNo,
                                DocumentDate: record.DocumentDate,
                                FileName: record.FileName,
                                Documenttype: record.DocumentType,
                                ReceivedDate: uploadDto.ReceivedDate ? new Date(uploadDto.ReceivedDate) : null,
                                FollowupRequire: uploadDto.FollowupRequired,
                                FollowupDate: uploadDto.FollowupDate ? new Date(uploadDto.FollowupDate) : '',
                                FollowupAction: uploadDto.FollowupAction || '',
                                Remarks: uploadDto.FollowupRemarks || '',
                                Public: uploadDto.Public || 'N',
                                sentEmail: uploadDto.sentEmail || 'N',
                                Status: uploadDto.FollowupStatus || 'A',
                                Subject: uploadDto.Subject || '',
                                InternalUser: uploadDto.InternalUser ? Number(uploadDto.InternalUser) : null,
                                ExternalUser: uploadDto.ExternalUser || null,
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
        let renamedFile: { from: string; to: string } | null = null;

        const exist: any = await this._db.attachDocument.findUnique({
            where: { AttachDocumentSid },
            include: { attachGroup: true },
        });

        if (!exist) {
            throw new BadRequestException(`Attach Document with id ${AttachDocumentSid} not found`);
        }

        const folderPath = path.join(
            UPLOAD_EDOC_PATH,
            exist.attachGroup.MenuName,
            String(exist.attachGroup.DocumentSid)
        );

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const hasPayload = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
        const payloadValue = (key: string, fallback: any = undefined) =>
            hasPayload(key) ? payload[key] : fallback;
        const documentType = payload.DocumentType || payload.Documenttype || exist.DocumentType;
        const requestedFileName = payload.FileName
            ? this.buildFileName(payload.FileName, documentType)
            : exist.FileName;
        const requestedFilePath = path.join(folderPath, requestedFileName);

        const newFiles: { file: Express.Multer.File; filePath: string }[] = [];
        if (files && files.length > 0) {
            for (const file of files) {
                const existingFile = await this._db.attachDocument.findFirst({
                    where: {
                        FileName: file.originalname,
                        AttachDocumentGroupSid: exist.AttachDocumentGroupSid,
                    },
                });
                if (!existingFile) {
                    newFiles.push({ file, filePath: path.join(folderPath, file.originalname) });
                }
            }
        }

        try {
            for (const { file, filePath } of newFiles) {
                fs.writeFileSync(filePath, file.buffer);
                savedFiles.push(filePath);
            }

            if (requestedFileName !== exist.FileName && fs.existsSync(exist.FilePath)) {
                fs.renameSync(exist.FilePath, requestedFilePath);
                renamedFile = { from: exist.FilePath, to: requestedFilePath };
            }
        } catch (error) {
            for (const filePath of savedFiles) {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (unlinkError) {
                    console.error('Failed to delete file during rollback:', filePath, unlinkError);
                }
            }
            if (renamedFile && fs.existsSync(renamedFile.to)) {
                try {
                    fs.renameSync(renamedFile.to, renamedFile.from);
                } catch (renameError) {
                    console.error('Failed to rollback renamed file:', renamedFile, renameError);
                }
            }
            throw error;
        }

        try {
            return await this._db.$transaction(async (tx) => {
                const updatedDoc = await tx.attachDocument.update({
                    where: { AttachDocumentSid },
                    data: {
                        AttachDocmentNo: payloadValue('AttachDocmentNo', exist.AttachDocmentNo),
                        DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : exist.DocumentDate,
                        FileName: requestedFileName,
                        DocumentType: documentType,
                        FilePath: requestedFilePath,
                        ReceivedDate: payload.ReceivedDate ? new Date(payload.ReceivedDate) : exist.ReceivedDate,
                        SentDate: payload.SentDate ? new Date(payload.SentDate) : exist.SentDate,
                        FollowupRequire: payloadValue('FollowupRequired', exist.FollowupRequire),
                        FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : exist.FollowupDate,
                        Public: payloadValue('Public', exist.Public),
                        status: payloadValue('EdocStatus', exist.status),
                        updatedBy: payload.updatedBy || payload.CreatedBy || 'system',
                        updatedOn: new Date(),
                    },
                });

                await tx.attachDocumentGroup.update({
                    where: { AttachDocumentGroupSid: exist.AttachDocumentGroupSid },
                    data: {
                        Remarks: payloadValue('EdocRemarks', exist.attachGroup.Remarks),
                        status: payloadValue('EdocStatus', exist.attachGroup.status),
                        updatedBy: payload.updatedBy || payload.CreatedBy || 'system',
                        updatedOn: new Date(),
                    },
                });

                for (const { file, filePath } of newFiles) {
                    await tx.attachDocument.create({
                        data: {
                            AttachDocumentGroupSid: exist.AttachDocumentGroupSid,
                            FileName: file.originalname,
                            FilePath: filePath,
                            DocumentType: path.extname(file.originalname).substring(1),
                            AttachDocmentNo: payloadValue('AttachDocmentNo', exist.AttachDocmentNo),
                            DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : exist.DocumentDate,
                            ReceivedDate: payload.ReceivedDate ? new Date(payload.ReceivedDate) : exist.ReceivedDate,
                            SentDate: payload.SentDate ? new Date(payload.SentDate) : exist.SentDate,
                            FollowupRequire: payloadValue('FollowupRequired', exist.FollowupRequire),
                            FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : exist.FollowupDate,
                            Public: payloadValue('Public', exist.Public),
                            status: payloadValue('EdocStatus', 'A'),
                            createdBy: payload.updatedBy || payload.CreatedBy || 'system',
                        },
                    });
                }

                if (payload.FollowupRequired === 'Y') {
                    const existingFollowup = await tx.followup.findFirst({
                        where: { AttachDocmentNo: exist.AttachDocmentNo },
                    });

                    if (existingFollowup) {
                        await tx.followup.update({
                            where: { FollowupSid: existingFollowup.FollowupSid },
                            data: {
                                AttachDocmentNo: payloadValue('AttachDocmentNo', existingFollowup.AttachDocmentNo),
                                DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : existingFollowup.DocumentDate,
                                FileName: requestedFileName,
                                Documenttype: documentType,
                                ReceivedDate: payload.ReceivedDate ? new Date(payload.ReceivedDate) : existingFollowup.ReceivedDate,
                                FollowupRequire: payload.FollowupRequired,
                                FollowupAction: payloadValue('FollowupAction', existingFollowup.FollowupAction),
                                FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : existingFollowup.FollowupDate,
                                Remarks: payloadValue('FollowupRemarks', existingFollowup.Remarks),
                                Public: payloadValue('Public', existingFollowup.Public || 'N'),
                                sentEmail: payloadValue('sentEmail', existingFollowup.sentEmail || 'N'),
                                Status: payloadValue('FollowupStatus', existingFollowup.Status),
                                Subject: payloadValue('Subject', existingFollowup.Subject),
                                InternalUser: payload.InternalUser != null ? Number(payload.InternalUser) : existingFollowup.InternalUser,
                                ExternalUser: payloadValue('ExternalUser', existingFollowup.ExternalUser),
                                UpdatedBy: payload.updatedBy || payload.CreatedBy || 'system',
                                UpdatedOn: new Date(),
                            },
                        });
                    } else {
                        await tx.followup.create({
                            data: {
                                CompanyMasterSid: exist.attachGroup.CompanyMasterSid,
                                BranchMasterSid: exist.attachGroup.BranchMasterSid,
                                MenuMasterSid: exist.attachGroup.MenuMasterSid,
                                DocumentSid: exist.attachGroup.DocumentSid,
                                AttachDocmentNo: payloadValue('AttachDocmentNo', exist.AttachDocmentNo),
                                DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : exist.DocumentDate,
                                FileName: requestedFileName,
                                Documenttype: documentType,
                                ReceivedDate: payload.ReceivedDate ? new Date(payload.ReceivedDate) : exist.ReceivedDate,
                                FollowupRequire: 'Y',
                                FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : new Date(),
                                FollowupAction: payload.FollowupAction || '',
                                Remarks: payload.FollowupRemarks || '',
                                Public: payload.Public || 'N',
                                sentEmail: payload.sentEmail || 'N',
                                Status: payload.FollowupStatus || 'A',
                                Subject: payload.Subject || '',
                                InternalUser: payload.InternalUser ? Number(payload.InternalUser) : null,
                                ExternalUser: payload.ExternalUser || null,
                                CreatedBy: payload.updatedBy || payload.CreatedBy || 'system',
                            },
                        });
                    }
                } else if (payload.FollowupRequired === 'N') {
                    await tx.followup.updateMany({
                        where: { AttachDocmentNo: exist.AttachDocmentNo },
                        data: {
                            FollowupRequire: 'N',
                            Status: payloadValue('FollowupStatus', 'S'),
                            UpdatedBy: payload.updatedBy || payload.CreatedBy || 'system',
                            UpdatedOn: new Date(),
                        },
                    });
                }

                if (payload.sentEmail === 'Y') {
                    this.sendUpdateEmailAsync(updatedDoc, payload, folderPath, files, exist).catch(err => {
                        console.error('Email sending failed:', err);
                    });
                }

                return { message: 'Document updated successfully', data: updatedDoc };
            });
        } catch (error) {
            for (const filePath of savedFiles) {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (unlinkError) {
                    console.error('Failed to delete file during rollback:', filePath, unlinkError);
                }
            }
            if (renamedFile && fs.existsSync(renamedFile.to)) {
                try {
                    fs.renameSync(renamedFile.to, renamedFile.from);
                } catch (renameError) {
                    console.error('Failed to rollback renamed file:', renamedFile, renameError);
                }
            }
            throw error;
        }
    }

    private buildFileName(fileName: string, documentType?: string): string {
        if (!documentType || path.extname(fileName)) {
            return fileName;
        }
        return `${fileName}.${documentType}`;
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

            const numericDocumentSid = Number(documentSid);
            if (!Number.isFinite(numericDocumentSid)) {
                throw new BadRequestException(`DocumentSid must be a valid number`);
            }
            const folderPath = path.join(UPLOAD_EDOC_PATH, menu.MenuName, String(numericDocumentSid));

            // 2️⃣ Find group and related files
            const groups = await this._db.attachDocumentGroup.findMany({
                where: { MenuMasterSid: Number(menuMasterSid), DocumentSid: numericDocumentSid },
                include: {
                    attachFiles: {
                        where: {
                            status: { in: ['A', 'S'] },
                        },
                    },
                },
                orderBy: { AttachDocumentGroupSid: 'asc' },
            });
            const group = groups[0];

            if (!group) {
                throw new Error("Document group not found");
            }
            group.attachFiles = groups.flatMap(item => item.attachFiles || []);

            // Extract all AttachDocumentSids
            const attachDocSids:any = group.attachFiles.map(file => file.AttachDocmentNo);

            const followups = await this._db.followup.findMany({
                where: {
                    AttachDocmentNo: { in: attachDocSids },
                    DocumentSid: numericDocumentSid,
                },
            });


            if (!group) throw new BadRequestException(`No AttachDocumentGroup found for MenuMasterSid: ${menuMasterSid}, DocumentSid: ${documentSid}`);
            if (!group.attachFiles || group.attachFiles.length === 0) {
                throw new BadRequestException(`No attached files found for this group`);
            }

            // 3️⃣ Optionally, read actual folder contents to verify physical files
            const filesOnDisk = fs.existsSync(folderPath) ? fs.readdirSync(folderPath) : [];

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
