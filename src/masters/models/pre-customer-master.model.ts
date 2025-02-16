import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { CompanyMaster } from './company-master.model';
import { BranchMaster } from './branch-master.model';
import { CityMaster } from './city-master.model';
import { CountryMaster } from './country-master.model';
import { StateMaster } from './state-master.model';

@Table({ tableName: 'PreCustomerMaster', timestamps: false })
export class PreCustomerMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  PreCustomerMasterSid: number;

  @ForeignKey(() => CompanyMaster)
  @Column({ type: DataType.INTEGER })
  CompanyMasterSid: number;

  @ForeignKey(() => CityMaster)
  @Column({ type: DataType.INTEGER })
  CityMasterSid: number;

  @ForeignKey(() => CountryMaster)
  @Column({ type: DataType.INTEGER })
  CountryMasterSid: number;

  @ForeignKey(() => StateMaster)
  @Column({ type: DataType.INTEGER })
  StateMasterSid: number;
  
  @ForeignKey(() => BranchMaster)
  @Column({ type: DataType.INTEGER })
  BranchMasterSid: number;

  @Column({ type: DataType.STRING(200) })
  PreCustomerName: string;

  @Column({ type: DataType.STRING(300) })
  PreCustomerAddress1: string;

  @Column({ type: DataType.STRING(300) })
  PreCustomerAddress2: string;

  @Column({ type: DataType.INTEGER })
  LeadAssignTo: number;

  @Column({ type: DataType.STRING(10) })
  CustomerType: string;

  @Column({ type: DataType.STRING(50) })
  ContactPerson: string;

  @Column({ type: DataType.STRING(100) })
  Email: string;

  @Column({ type: DataType.STRING(50) })
  Phone: string;

  @Column({ type: DataType.STRING(10) })
  PreCustomerType: string;

  @Column({ type: DataType.STRING(20) })
  LeadFrom: string;

  @Column({ type: DataType.STRING(20) })
  LeadReferredBy: string;

  @Column({ type: DataType.STRING(20) })
  PanVat: string;

  @Column({ type: DataType.STRING(500) })
  Remarks: string;

  @Column({ type: DataType.DATE })
  CreatedOn: Date;

  @Column({ type: DataType.STRING(100) })
  CreatedBy: string;

  @Column({ type: DataType.DATE })
  UpdatedOn: Date;

  @Column({ type: DataType.STRING(100) })
  UpdatedBy: string;

  @Column({ type: DataType.CHAR(1) })
  Status: string;

  @BelongsTo(() => CompanyMaster)
  company: CompanyMaster;

  @BelongsTo(() => BranchMaster)
  branch: BranchMaster;
}
