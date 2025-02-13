import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { CompanyMaster } from './company-master.model';

@Table({ tableName: 'DepartmentMaster', timestamps: false })
export class DepartmentMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  DepartmentMasterSid: number;

  @ForeignKey(() => CompanyMaster)
  @Column({ type: DataType.INTEGER })
  CompanyMasterSid: number;

  @Column({ type: DataType.STRING(20), allowNull: false })
  DepartmentName: string;

  @Column({ type: DataType.STRING(5) })
  DepartmentCode: string;

  @Column({ type: DataType.STRING(10) })
  DepartmentType: string;

  @Column({ type: DataType.STRING(6) })
  ExportImport: string;

  @Column({ type: DataType.STRING(6) })
  FCLLCL: string;

  @Column({ type: DataType.CHAR(1) })
  Status: string;
  

  @BelongsTo(() => CompanyMaster)
  company: CompanyMaster;
}
