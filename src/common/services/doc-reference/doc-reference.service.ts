import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class DocReferenceService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly logger: Logger,
  ) {}

  async getAllDocReference(payload:any) {
    try {
      const docReference = await this._db.refDocument.findMany({
        where: {
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          DocumentSid: payload.DocumentSid,
          MenuMasterSid: payload.MenuMasterSid,
          Status: 'A',
        }
      })
      return docReference;
    } catch (error) {
      throw error;
    }
  }

  async createDocReference(payload){
    try {
      const docReference = await this._db.$transaction(async (prisma) => {
        const doc = await prisma.refDocument.create({
          data: {
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            MenuMasterSid: payload.MenuMasterSid,
            DocumentSid: payload.DocumentSid,
            RefDocumentNo: payload.RefDocumentNo,
            RefDocumentDate: payload.RefDocumentDate,
            Remarks: payload.Remarks,
            Public: payload.Public,
            Status: 'A',
            CreatedBy: payload.CreatedBy
          }
        })
      })
      return docReference;
    } catch (error) {
      throw error;
    }
  }

  async fetchDocReferenceById(refDocumentSid: number) {
    try {
      const docReference = await this._db.refDocument.findUnique({
        where: {
          RefDocumentSid: refDocumentSid,
          Status: 'A',
        }
      })
      if (!docReference) {
        throw new BadRequestException(`Doc Reference with id: ${refDocumentSid} not exists`);
      }
      return docReference;
    } catch (error) {
      throw error;
    }
  }

  async updateDocReferenceById(refDocumentSid: number, payload) {
    try {
      const updateDoc: any = await this._db.refDocument.update({
        where: {
          RefDocumentSid: refDocumentSid,
        },
        data: {
          RefDocumentNo: payload.RefDocumentNo,
          RefDocumentDate: payload.RefDocumentDate,
          Remarks: payload.Remarks,
          Public: payload.Public,
          Status: payload.Status,
          UpdatedBy: payload.UpdatedBy,
          UpdatedOn: new Date(),
        }
      })
      return updateDoc;
    } catch (error) {
      throw error;
    }
  }

  async deleteDocReference(refDocumentSid: number) {
    try {
      const deleteDoc: any = await this._db.refDocument.update({
        where: {
          RefDocumentSid: refDocumentSid,
        },
        data: {
          Status: 'D',
        }
      })
      return deleteDoc;
    } catch (err) {
      throw err;
    }
  }
 
  
}
