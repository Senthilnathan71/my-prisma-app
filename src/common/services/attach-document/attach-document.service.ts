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

    //create

    async createNewAttachDocumentGroup(
        files: Express.Multer.File[],
        uploadDto: any,
        menuName: string,
        user: any
    ) {
        const basePath = this.configService.get('UPLOAD_EDOC_PATH');
        try {
            // 1️⃣ Create AttachDocumentGroup
            const group = await this._db.attachDocumentGroup.create({
                data: {
                    CompanyMasterSid: Number(uploadDto.CompanyMasterSid),
                    BranchMasterSid: Number(uploadDto.BranchMasterSid),
                    MenuMasterSid: Number(uploadDto.MenuMasterSid),
                    MenuName: menuName,
                    DocumentSid: Number(uploadDto.DocumentSid),
                    Remarks: uploadDto.Remarks || '',
                    createdBy: user?.userName || 'system',
                },
            });

            // 2️⃣ Ensure folder exists
            const folderPath = path.join(basePath, menuName, String(uploadDto.DocumentSid));
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

            // 3️⃣ Create AttachDocument entries
            const createdFiles: any = [];
            for (const file of files) {
                const filePath = path.join(folderPath, file.originalname);
                fs.writeFileSync(filePath, file.buffer);

                const record: any = await this._db.attachDocument.create({
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
                        createdBy: user?.userName || 'system',
                    },
                });

                createdFiles.push(record);
            }

            return { group, createdFiles };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }



    //update
    async updateAttachDocumentById(
        files: Express.Multer.File[],
        AttachDocumentSid: number,
        payload: any,
    ) {
        const UPLOAD_EDOC_PATH = this.configService.get('UPLOAD_EDOC_PATH');

        return this._db.$transaction(async (tx) => {
            // 1️⃣ Fetch existing document + group
            const exist: any = await tx.attachDocument.findUnique({
                where: { AttachDocumentSid },
                include: { attachGroup: true },
            });

            if (!exist) throw new BadRequestException(`Attach Document with id ${AttachDocumentSid} not found`);

            const folderPath = path.join(
                UPLOAD_EDOC_PATH,
                exist.attachGroup.MenuName,
                String(exist.attachGroup.DocumentSid)
            );
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

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

            // 3️⃣ Save new files if uploaded, without duplicates
            if (files && files.length > 0) {
                for (const file of files) {
                    const filePath = path.join(folderPath, file.originalname);
                    const existingFile = await tx.attachDocument.findFirst({
                        where: { FileName: file.originalname, AttachDocumentGroupSid: exist.AttachDocumentGroupSid },
                    });

                    if (!existingFile) {
                        fs.writeFileSync(filePath, file.buffer);
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
                                createdBy: payload.updatedBy || 'system',
                            },
                        });
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
                } else {
                    await tx.followup.create({
                        data: {
                            CompanyMasterSid: exist.CompanyMasterSid,
                            BranchMasterSid: exist.BranchMasterSid,
                            DocumentSid: exist.DocumentSid,
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
                            Status: payload.FollowupStatus || '',
                            CreatedBy: payload.updatedBy || 'system',
                        },
                    });
                }
            } else if (payload.FollowupRequired === 'N') {
                await tx.followup.updateMany({
                    where: { AttachDocmentNo: exist.AttachDocmentNo },
                    data: { Status: 'S' },
                });
            }

            // 5️⃣ Email sending
            if (payload.sentEmail === 'Y') {
                const templatePath = path.join(process.cwd(), 'src', 'email', 'templates', 'followup-email.pug');
                const html = pug.renderFile(templatePath, {
                    recipientName: 'User',
                    fileName: updatedDoc.FileName,
                    link: '#',
                    followupDate: payload.FollowupDate ? new Date(payload.FollowupDate).toLocaleDateString() : 'N/A',
                    remarks: payload.FollowupRemarks || '',
                });

                // attach first new file or existing
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
            }

            return { message: 'Document updated successfully', data: updatedDoc };
        });
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
                where: { MenuMasterSid: menuMasterSid, DocumentSid: documentSid },
                include: {
                    attachFiles: true, // includes all related files
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
                filesOnDisk,
            };
        } catch (error) {
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