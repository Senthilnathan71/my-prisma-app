import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import * as path from 'path'
import { CreateAttachDocumentDto } from 'src/common/dto/attach-document.dto';
@Injectable()
export class AttachDocumentService {
    constructor(private _db: DatabaseService) { }

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
        uploadDto: CreateAttachDocumentDto) {
        try {
            const menuName:any = await this._db.menuMaster.findUnique({
                where:{
                    MenuMasterSid:uploadDto.MenuMasterSid
                },select:{MenuName:true}
            })
            const edocRecords = await Promise.all(
                files.map(async (file) => {
                    return await this._db.attachDocument.create({
                        data: {
                            CompanyMasterSid: uploadDto.CompanyMasterSid,
                            BranchMasterSid: uploadDto.BranchMasterSid,
                            menuName: menuName || null,
                            DocumentSid: Number(uploadDto.DocumentSid),
                            AttachDocmentNo: uploadDto.AttachDocmentNo,
                            DocumentDate: uploadDto.DocumentDate ? new Date(uploadDto.DocumentDate) : '',
                            FileName: file.originalname,
                            Documenttype: uploadDto.Documenttype || path.extname(file.originalname).substring(1),
                            ReceivedDate: uploadDto.ReceivedDate ? new Date(uploadDto.ReceivedDate) : null,
                            SentDate: uploadDto.SentDate ? new Date(uploadDto.SentDate) : null,
                            FollowupRequire: uploadDto.FollowupRequire || '',
                            FollowupDate: uploadDto.FollowupDate ? new Date(uploadDto.FollowupDate) : null,
                            Remarks: uploadDto.Remarks,
                            status: uploadDto.status,
                            createdBy: uploadDto.createdBy || 'system',
                        },
                    });
                })
            );
            return edocRecords;
        } catch (error) {
            console.log(error.stack)
            throw error;
        }
    }

    async fetchAttachDocumentById(AttachDocumentSid: number) {
        try {
            const attachDocument = await this._db.attachDocument.findUnique({
                where: {
                    AttachDocumentSid: AttachDocumentSid
                },
                include: {
                    companyMaster: true,
                    branchMaster: true
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

    async updateAttachDocumentById(AttachDocumentSid: number, payload: any) {
        try {
            const exist = await this._db.attachDocument.findUnique({
                where: {
                    AttachDocumentSid: AttachDocumentSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Attach Document with Id : ${AttachDocumentSid} not exists`);
            }
            const updatedAttachDocument = await this._db.attachDocument.update({
                where: {
                    AttachDocumentSid: AttachDocumentSid
                },
                data: payload,
                include: {
                    companyMaster: true,
                    branchMaster: true
                }
            });
            return updatedAttachDocument;
        } catch (error) {
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
}