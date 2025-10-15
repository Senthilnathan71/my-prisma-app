import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import * as fs from 'fs';
import * as path from 'path';
import { CreateAttachDocumentDto } from 'src/common/dto/attach-document.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/email/email.service';
@Injectable()
export class AttachDocumentService {
    constructor(
        private _db: DatabaseService,
        private configService: ConfigService,
    ) { }

    async getAllAttachDocuments() {
        try {
            const allAttachDocuments = await this._db.attachDocument.findMany({
                where: {
                    status: 'A'
                },
                include: {
                    companyMaster: true,
                    branchMaster: true
                }
            });
            return allAttachDocuments;
        } catch (error) {
            throw error;
        }
    }



    async createNewAttachDocument(
        files: Express.Multer.File[],
        uploadDto: any,
        menuName: any,
        user: any
    ) {
        try {
            const edocRecords = await Promise.all(
                files.map(async (file) => {
                    console.log('Processing file:', file?.originalname);

                    // Step 1: Save file record in database
                    const docRecord: any = await this._db.attachDocument.create({
                        data: {
                            CompanyMasterSid: Number(uploadDto.CompanyMasterSid),
                            BranchMasterSid: Number(uploadDto.BranchMasterSid),
                            MenuMasterSid: Number(uploadDto.MenuMasterSid),
                            menuName: menuName || null,
                            DocumentSid: Number(uploadDto.DocumentSid),
                            AttachDocmentNo: uploadDto.AttachDocmentNo,
                            DocumentDate: uploadDto.DocumentDate ? new Date(uploadDto.DocumentDate) : '',
                            FileName: file?.originalname,
                            Documenttype: uploadDto.DocumentType || (file?.originalname ? path.extname(file.originalname).substring(1) : ''),
                            ReceivedDate: uploadDto.ReceivedDate ? new Date(uploadDto.ReceivedDate) : '',
                            SentDate: uploadDto.SentDate ? new Date(uploadDto.SentDate) : '',
                            FollowupRequire: uploadDto.FollowupRequired || '',
                            FollowupDate: uploadDto.FollowupDate ? new Date(uploadDto.FollowupDate) : '',
                            Remarks: uploadDto.EdocRemarks,
                            status: uploadDto.EdocStatus,
                            createdBy: uploadDto.createdBy || 'system',
                        },
                    });

                    // Step 2: Create followup record if required
                    let followupRes;
                    if (uploadDto.FollowupRequired === 'Y') {
                        followupRes = await this._db.followup.create({
                            data: {
                                CompanyMasterSid: docRecord.CompanyMasterSid,
                                BranchMasterSid: docRecord.BranchMasterSid,
                                DocumentSid: docRecord.DocumentSid,
                                AttachDocmentNo: docRecord.AttachDocmentNo,
                                DocumentDate: docRecord.DocumentDate,
                                FileName: docRecord.FileName,
                                Documenttype: docRecord.Documenttype,
                                ReceivedDate: docRecord.ReceivedDate,
                                FollowupRequire: uploadDto.FollowupRequired,
                                FollowupDate: uploadDto.FollowupDate ? new Date(uploadDto.FollowupDate) : "",
                                FollowupAction: uploadDto.FollowupAction,
                                Remarks: uploadDto.FollowupRemarks,
                                Public: uploadDto.Public || 'N',
                                sentEmail: uploadDto.sentEmail || 'N',
                                Status: uploadDto.FollowupStatus,
                                CreatedBy: docRecord.createdBy,
                            },
                        });
                    }

                    return docRecord;
                })
            );

            return edocRecords;

        } catch (error) {
            console.log(error.stack);
            throw error;
        }
    }

    async fetchAttachDocumentById(AttachDocumentSid: number) {
        try {
            const attachDocument = await this._db.attachDocument.findMany({
                where: {
                    AttachDocumentSid: AttachDocumentSid,
                },
                include: {
                    companyMaster: true,
                    branchMaster: true,
                }
            });
            if (!attachDocument) {
                throw new BadRequestException(`Attach Document with Id : ${AttachDocumentSid} not exists`);
            }
            return attachDocument;
        } catch (error) {
            throw error;
        }
    }

    async updateAttachDocumentById(
        files: Express.Multer.File[],
        AttachDocumentSid: number,
        payload: any,
    ) {
        try {

            const exist = await this._db.attachDocument.findUnique({
                where: { AttachDocumentSid },
                include: { companyMaster: true, branchMaster: true, menuMaster: true },
            });

            if (!exist) {
                throw new BadRequestException(`Attach Document with Id: ${AttachDocumentSid} not found`);
            }

            // Get upload base path
            const UPLOAD_EDOC_PATH = this.configService.get('UPLOAD_EDOC_PATH');
            const menuName: any = exist.menuMaster?.MenuName;
            const folderPath = path.join(UPLOAD_EDOC_PATH, menuName, String(exist.DocumentSid));

            // Ensure folder exists
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            const result = await this._db.$transaction(async (tx) => {
                let updatedFileName = exist.FileName;
                let updatedFileType = exist.Documenttype;

                // --- Step 1: Handle new file upload ---
                if (files && files.length > 0) {
                    const newFile = files[0];
                    const newFilePath = path.join(folderPath, newFile.originalname);

                    // Delete old file safely if exists
                    const oldFilePath = path.join(folderPath, exist.FileName);
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }

                    // Move new file to target path
                    fs.writeFileSync(newFilePath, newFile.buffer);

                    updatedFileName = newFile.originalname;
                    updatedFileType =
                        payload.DocumentType ||
                        path.extname(newFile.originalname).substring(1) ||
                        exist.Documenttype;
                }

                // --- Step 2: Update attachDocument ---
                const updatedAttachDocument = await tx.attachDocument.update({
                    where: { AttachDocumentSid },
                    data: {
                        FollowupRequire: payload.FollowupRequired ?? exist.FollowupRequire,
                        FileName: updatedFileName,
                        Documenttype: updatedFileType,
                        DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : exist.DocumentDate,
                        ReceivedDate: payload.ReceivedDate ? new Date(payload.ReceivedDate) : exist.ReceivedDate,
                        SentDate: payload.SentDate ? new Date(payload.SentDate) : exist.SentDate,
                        FollowupDate: payload.FollowupDate ? new Date(payload.FollowupDate) : exist.FollowupDate,
                        updatedOn: new Date(),
                        AttachDocmentNo: payload.AttachDocmentNo ?? exist.AttachDocmentNo,
                        CompanyMasterSid: Number(payload.CompanyMasterSid) ?? exist.CompanyMasterSid,
                        BranchMasterSid: Number(payload.BranchMasterSid) ?? exist.BranchMasterSid,
                        MenuMasterSid: Number(payload.MenuMasterSid) ?? exist.MenuMasterSid,
                        DocumentSid: Number(payload.DocumentSid) ?? exist.DocumentSid,
                        menuName: payload.menuName ?? exist.menuName,
                        status: payload.status ?? exist.status,
                        Remarks: payload.Remarks ?? exist.Remarks,
                        updatedBy: payload.updatedBy ?? exist.updatedBy,
                    },
                    include: { companyMaster: true, branchMaster: true },
                });

                // --- Step 3: Follow-up logic ---
                if (payload.FollowupRequired === 'Y') {
                    const existingFollowup = await tx.followup.findFirst({
                        where: { AttachDocmentNo: updatedAttachDocument.AttachDocmentNo },
                    });

                    if (existingFollowup) {
                        await tx.followup.update({
                            where: { FollowupSid: existingFollowup.FollowupSid },
                            data: {
                                FollowupAction: payload.FollowupAction || existingFollowup.FollowupAction,
                                FollowupDate: payload.FollowupDate
                                    ? new Date(payload.FollowupDate)
                                    : existingFollowup.FollowupDate,
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
                                CompanyMasterSid: updatedAttachDocument.CompanyMasterSid,
                                BranchMasterSid: updatedAttachDocument.BranchMasterSid,
                                DocumentSid: updatedAttachDocument.DocumentSid,
                                AttachDocmentNo: updatedAttachDocument.AttachDocmentNo,
                                DocumentDate: updatedAttachDocument.DocumentDate,
                                FileName: updatedAttachDocument.FileName,
                                Documenttype: updatedAttachDocument.Documenttype,
                                ReceivedDate: updatedAttachDocument.ReceivedDate,
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

                return updatedAttachDocument;
            });

            return result;
        } catch (error) {
            console.error('Error in updateAttachDocumentById:', error);
            throw error;
        }
    }


    async deleteAttachDocument(AttachDocumentSid: number) {
        try {
            const exist = await this._db.attachDocument.findUnique({
                where: {
                    AttachDocumentSid: AttachDocumentSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Attach Document with Id : ${AttachDocumentSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`Attach Document with Id :${AttachDocumentSid} is already deleted`);
            }
            const deletedAttachDocument = await this._db.attachDocument.update({
                where: {
                    AttachDocumentSid: AttachDocumentSid
                },
                data: {
                    status: 'D'
                },
                include: {
                    companyMaster: true,
                    branchMaster: true
                }
            });
            return deletedAttachDocument;
        } catch (error) {
            throw error;
        }
    }

    async searchAttachDocument(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'AttachDocumentSid',
            'CompanyMasterSid',
            'BranchMasterSid',
            'DocumentSid'
        ];
        const stringFields = [
            'AttachDocmentNo',
            'FileName',
            'Documenttype',
            'FollowupRequire',
            'Public',
            'createdBy',
            'updatedBy',
            'status',
            'Remarks'
        ];
        const dateFields = [
            'DocumentDate',
            'ReceivedDate',
            'FollowupDate'
        ];
        const acceptedType = [...intFields, ...stringFields, ...dateFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {};

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            };
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        } else if (dateFields.includes(searchType)) {
            const dateValue = new Date(filterValue);
            if (isNaN(dateValue.getTime())) {
                throw new BadRequestException(`${searchType} must be a valid date`);
            }
            whereClause[searchType] = dateValue;
        }

        const searchResults = await this._db.attachDocument.findMany({
            where: {
                ...whereClause,
                status: 'A'
            },
            include: {
                companyMaster: true,
                branchMaster: true
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${JSON.stringify(err)}`);
        });

        return searchResults;
    }

    async fetchAttachDocumentByFolder(menuMasterSid: number, DocumentSid: number) {
        const UPLOAD_EDOC_PATH = this.configService.get("UPLOAD_EDOC_PATH");
        try {
            // Step 1: Get menu name from MenuMaster
            const menu = await this._db.menuMaster.findUnique({
                where: { MenuMasterSid: Number(menuMasterSid) },
                select: { MenuName: true },
            });

            if (!menu) {
                throw new BadRequestException(`MenuMaster not found for ID ${menuMasterSid}`);
            }

            const menuName = menu.MenuName;
            const folderPath = path.join(UPLOAD_EDOC_PATH, menuName, String(DocumentSid));

            // Step 2: Check if folder exists
            if (!fs.existsSync(folderPath)) {
                throw new BadRequestException(`Folder not found: ${folderPath}`);
            }

            // Step 3: Read files inside the folder
            const files = fs.readdirSync(folderPath);

            if (files.length === 0) {
                throw new BadRequestException(`No files found inside folder: ${folderPath}`);
            }

            if (files.length > 1) {
            }

            const selectedFileName = files[0];

            // Step 4: Query database to find the record
            const attachDocument = await this._db.attachDocument.findFirst({
                where: {
                    MenuMasterSid: Number(menuMasterSid),
                    DocumentSid: DocumentSid,
                    FileName: selectedFileName,
                },
                include: {
                    companyMaster: true,
                    branchMaster: true,
                    menuMaster: true,
                },
            });

            let followupResponse;
            if (attachDocument?.FollowupRequire == "Y") {
                followupResponse = await this._db.followup.findFirst({
                    where: {
                        AttachDocmentNo: attachDocument?.AttachDocmentNo,
                    },
                    select: {
                        FollowupAction: true,
                        FollowupRequire: true,
                        FollowupDate: true,
                        FollowupSid: true,
                        Public: true,
                        sentEmail: true,
                        Remarks: true,
                        Status: true
                    }
                })
            }


            if (!attachDocument) {
                throw new BadRequestException(`AttachDocument record not found for file: ${selectedFileName}`);
            }

            return { attachDocument, followupResponse };
        } catch (error) {
            throw error;
        }
    }

}