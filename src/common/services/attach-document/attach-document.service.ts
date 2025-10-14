import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import * as fs from 'fs';
import * as path from 'path';
import { CreateAttachDocumentDto } from 'src/common/dto/attach-document.dto';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AttachDocumentService {
    constructor(
        private _db: DatabaseService,
        private configService: ConfigService
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
        uploadDto: CreateAttachDocumentDto,
        menuName:any    
    ) {
        try {
            const edocRecords = await Promise.all(
                files.map(async (file) => {
                          console.log('Processing file:', file?.originalname);
                    return await this._db.attachDocument.create({
                        data: {
                            CompanyMasterSid: Number(uploadDto.CompanyMasterSid),
                            BranchMasterSid: Number(uploadDto.BranchMasterSid),
                            MenuMasterSid: Number(uploadDto.MenuMasterSid),
                            menuName: menuName || null,
                            DocumentSid: Number(uploadDto.DocumentSid),
                            AttachDocmentNo: uploadDto.AttachDocmentNo,
                            DocumentDate: new Date(uploadDto.DocumentDate),
                            FileName: file?.originalname,
                            Documenttype: uploadDto.DocumentType || (file?.originalname ? path.extname(file.originalname).substring(1) : ''),
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
            const attachDocument = await this._db.attachDocument.findMany({
                where: {
                    AttachDocumentSid: AttachDocumentSid,
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

      if (!attachDocument) {
        throw new BadRequestException(`AttachDocument record not found for file: ${selectedFileName}`);
      }

      return attachDocument;
    } catch (error) {
      throw error;
    }
  }

}