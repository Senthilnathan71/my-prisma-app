import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

type FindAllFilter = {
  CompanyMasterSid?: number | string;
  BranchMasterSid?: number | string;
  Status?: string;
  search?: string;
  RefDocumentNo?: string;
  Remarks?: string;
  searchTerm?: string;
};

@Injectable()
export class DocReferenceService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly logger: Logger,
  ) {}

 
  private validateInput(doc: any): string[] {
    const errors: string[] = [];

    
    if (!doc?.refDocumentNo || doc.refDocumentNo.toString().trim() === '') {
      errors.push('RefDocumentNo is required');
    } else {
      const refNo = doc.refDocumentNo.toString().trim();
      if (refNo.length > 20) {
        errors.push(
          `RefDocumentNo cannot exceed 20 characters (provided: ${refNo.length})`,
        );
      }
    }

    
    if (!doc?.documentDate) {
      errors.push('Document Date is required');
    } else {
      const d = new Date(doc.documentDate);
      if (isNaN(d.getTime())) {
        errors.push('Invalid Document Date');
      }
    }

    
    if (!doc?.status) {
      errors.push('Status is required');
    } else {
      const s = doc.status.toString().trim().toUpperCase();
      if (!['ACTIVE', 'INACTIVE', 'A', 'I'].includes(s)) {
        errors.push(
          `Invalid status: ${doc.status}. Must be 'Active' or 'Inactive'`,
        );
      }
    }

    
    return errors;
  }

  private convertStatusToDatabase(status: string): string {
    if (!status) return 'A';
    const s = status.toString().trim().toUpperCase();
    if (s === 'INACTIVE' || s === 'I') return 'I';
    if (s === 'ACTIVE' || s === 'A') return 'A';
    this.logger.warn(`⚠️ Unknown status: "${status}", defaulting to Active`);
    return 'A';
  }

 
  private convertPublicToDatabase(value: any): 'Y' | 'N' {
    if (typeof value === 'boolean') {
      return value ? 'Y' : 'N';
    }
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (['true', '1', 'y', 'yes'].includes(v)) return 'Y';
      if (['false', '0', 'n', 'no'].includes(v)) return 'N';
    }
    return value ? 'Y' : 'N';
  }

  async create(payload: any, user: any) {
    try {
      const {
        CompanyMasterSid,
        BranchMasterSid,
        MenuMasterSid,
        DocumentSid,
        documentReferences,
        createdBy,
        updatedBy,
      } = payload || {};

      if (!CompanyMasterSid || !BranchMasterSid || !MenuMasterSid) {
        throw new BadRequestException(
          'CompanyMasterSid, BranchMasterSid and MenuMasterSid are required',
        );
      }

      const menuMasterSid = Number(MenuMasterSid);
      const documentSid = DocumentSid || 0;
      const actor = createdBy || updatedBy || user?.userEmail || 'system';

      this.logger.log(
        `Create/Update RefDocument – Company=${CompanyMasterSid}, Branch=${BranchMasterSid}, Menu=${menuMasterSid}, DocumentSid=${documentSid}`,
      );

     
      if (documentSid && documentSid > 0) {
        const existing = await this._db.refDocument.findUnique({
          where: { RefDocumentSid: documentSid },
        });
        if (!existing) {
          throw new NotFoundException(
            `RefDocument with ID ${documentSid} not found`,
          );
        }

        const doc =
          Array.isArray(documentReferences) && documentReferences.length
            ? documentReferences[0]
            : {};

        const errors = this.validateInput(doc);
        if (errors.length) {
          throw new BadRequestException(
            `Validation failed for reference 1: ${errors.join('; ')}`,
          );
        }

        const updated = await this._db.refDocument.update({
          where: { RefDocumentSid: documentSid },
          data: {
            CompanyMasterSid,
            BranchMasterSid,
            MenuMasterSid: menuMasterSid,
            RefDocumentNo: doc.refDocumentNo
              .toString()
              .trim(), 
            RefDocumentDate: new Date(doc.documentDate),
            Remarks: doc.remarks ? doc.remarks.toString().trim() : null,
            Public: this.convertPublicToDatabase(doc.isPublic),
            Status: this.convertStatusToDatabase(doc.status),
            UpdatedBy: actor,
          },
        });

        this.logger.log(`✅ Updated RefDocumentSid=${documentSid}`);
        return {
          Status: true,
          data: updated,
          message: 'Document Reference updated successfully',
        };
      }

      
      if (!Array.isArray(documentReferences) || documentReferences.length === 0) {
        throw new BadRequestException('At least one document reference is required');
      }

      for (let i = 0; i < documentReferences.length; i++) {
        const errors = this.validateInput(documentReferences[i]);
        if (errors.length) {
          throw new BadRequestException(
            `Validation failed for reference ${i + 1}: ${errors.join('; ')}`,
          );
        }
      }

      const createPromises = documentReferences.map((doc: any, idx: number) => {
        this.logger.log(
          `Creating RefDocument #${idx + 1} – RefDocumentNo=${doc.refDocumentNo}`,
        );

        return this._db.refDocument.create({
          data: {
            CompanyMasterSid,
            BranchMasterSid,
            MenuMasterSid: menuMasterSid,
            DocumentSid: 0,
            RefDocumentNo: doc.refDocumentNo
              .toString()
              .trim(),
            RefDocumentDate: new Date(doc.documentDate),
            Remarks: doc.remarks ? doc.remarks.toString().trim() : null,
            Public: this.convertPublicToDatabase(doc.isPublic),
            Status: this.convertStatusToDatabase(doc.status),
            CreatedBy: actor,
            UpdatedBy: actor,
          },
        });
      });

      const results = await Promise.all(createPromises);
      this.logger.log(`✅ Created ${results.length} RefDocument record(s)`);

      return {
        Status: true,
        data: results,
        message: `Created ${results.length} document reference(s) successfully`,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error in create RefDocument: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create RefDocument: ${error.message}`,
      );
    }
  }

 
  async findAll(filter: FindAllFilter) {
    try {
      const where: any = {};

      if (filter?.CompanyMasterSid) {
        const companyId =
          typeof filter.CompanyMasterSid === 'string'
            ? parseInt(filter.CompanyMasterSid, 10)
            : filter.CompanyMasterSid;
        if (!isNaN(companyId)) where.CompanyMasterSid = companyId;
      }

      if (filter?.BranchMasterSid) {
        const branchId =
          typeof filter.BranchMasterSid === 'string'
            ? parseInt(filter.BranchMasterSid, 10)
            : filter.BranchMasterSid;
        if (!isNaN(branchId)) where.BranchMasterSid = branchId;
      }

      
      if (filter?.Status && filter.Status !== 'ALL') {
        where.Status = filter.Status; 
      } else {
        where.Status = 'A'; 
      }

      const searchTermValue =
        filter?.search ||
        filter?.RefDocumentNo ||
        filter?.Remarks ||
        filter?.searchTerm;

      if (searchTermValue && typeof searchTermValue === 'string') {
        const term = searchTermValue.trim();
        if (term) {
          where.OR = [
            {
              RefDocumentNo: {
                contains: term,
                mode: 'insensitive',
              },
            },
            {
              Remarks: {
                contains: term,
                mode: 'insensitive',
              },
            },
          ];
        }
      }

      const list = await this._db.refDocument.findMany({
        where,
        orderBy: { RefDocumentSid: 'desc' },
      });

      this.logger.log(`findAll returned ${list.length} records`);

      return { Status: true, data: list, message: `Found ${list.length} documents` };
    } catch (error: any) {
      this.logger.error(`Error in findAll RefDocument: ${error.message}`);
      throw new BadRequestException(
        `Failed to fetch documents: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  async findOne(id: number) {
    try {
      const item = await this._db.refDocument.findUnique({
        where: { RefDocumentSid: id },
      });
      if (!item) {
        throw new NotFoundException(`RefDocument with ID ${id} not found`);
      }
      return { Status: true, data: item, message: 'Document found' };
    } catch (error: any) {
      this.logger.error(`Error in findOne RefDocument: ${error.message}`);
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Failed to fetch document: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  async update(id: number, payload: any, user: any) {
    try {
      const existing = await this._db.refDocument.findUnique({
        where: { RefDocumentSid: id },
      });
      if (!existing) {
        throw new NotFoundException(`RefDocument with ID ${id} not found`);
      }

      const actor = payload?.updatedBy || user?.userEmail || 'system';

      const dataToUpdate: any = {
        RefDocumentNo: payload?.refDocumentNo
          ? payload.refDocumentNo.toString().trim()
          : existing.RefDocumentNo,
        Remarks:
          payload?.remarks !== undefined
            ? payload.remarks
              ? payload.remarks.toString().trim()
              : null
            : existing.Remarks,
        Public:
          payload?.isPublic !== undefined
            ? this.convertPublicToDatabase(payload.isPublic)
            : existing.Public,
        Status:
          payload?.status !== undefined
            ? this.convertStatusToDatabase(payload.status)
            : existing.Status,
        UpdatedBy: actor,
      };

      if (payload?.documentDate) {
        dataToUpdate.RefDocumentDate = new Date(payload.documentDate);
      }

      const updated = await this._db.refDocument.update({
        where: { RefDocumentSid: id },
        data: dataToUpdate,
      });

      return {
        Status: true,
        data: updated,
        message: 'Document Reference updated successfully',
      };
    } catch (error: any) {
      this.logger.error(`Error updating RefDocument: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error updating RefDocument: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  async softDelete(id: number) {
    try {
      const existing = await this._db.refDocument.findUnique({
        where: { RefDocumentSid: id },
      });

      if (!existing) {
        throw new NotFoundException(`RefDocument with ID ${id} not found`);
      }

      if (existing.Status === 'D') {
        throw new BadRequestException(
          `RefDocument with ID ${id} already deleted`,
        );
      }

      const deleted = await this._db.refDocument.update({
        where: { RefDocumentSid: id },
        data: { Status: 'D' },
      });

      return {
        Status: true,
        data: deleted,
        message: 'Document Reference deleted successfully',
      };
    } catch (error: any) {
      this.logger.error(`Error deleting RefDocument: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error deleting RefDocument: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
