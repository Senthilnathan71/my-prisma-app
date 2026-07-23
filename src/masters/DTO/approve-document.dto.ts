import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** One document approve/reject request. `decision` is set by the controller route. */
export class ApproveDocumentDto {
  @IsInt()
  UserMasterSid: number;

  @IsInt()
  CompanyMasterSid: number;

  @IsInt()
  BranchMasterSid: number;

  @IsInt()
  MenuMasterSid: number;

  @IsInt()
  DocumentSid: number;

  @IsOptional()
  @IsInt()
  DepartmentMasterSid?: number;

  @IsOptional()
  @IsString()
  Remarks?: string;

  /** Display name / email of the acting user (used for CreatedBy on AuthorityLog). */
  @IsOptional()
  @IsString()
  ApprovedBy?: string;
}

/** One row inside a bulk approve/reject payload. */
export class BulkApproveItemDto {
  @IsInt()
  MenuMasterSid: number;

  @IsInt()
  DocumentSid: number;

  @IsOptional()
  @IsInt()
  DepartmentMasterSid?: number;
}

/** Bulk approve/reject. Shared scope + a list of documents. */
export class BulkApproveDto {
  @IsInt()
  UserMasterSid: number;

  @IsInt()
  CompanyMasterSid: number;

  @IsInt()
  BranchMasterSid: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkApproveItemDto)
  items: BulkApproveItemDto[];

  @IsOptional()
  @IsString()
  Remarks?: string;

  @IsOptional()
  @IsString()
  ApprovedBy?: string;
}

/** System auto-approval trigger for a single document. */
export class AutoApproveDto {
  @IsInt()
  MenuMasterSid: number;

  @IsInt()
  DocumentSid: number;

  @IsInt()
  CompanyMasterSid: number;

  @IsInt()
  BranchMasterSid: number;

  @IsOptional()
  @IsInt()
  DepartmentMasterSid?: number;
}
