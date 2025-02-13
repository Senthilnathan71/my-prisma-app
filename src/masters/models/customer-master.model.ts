import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { CompanyMaster } from './company-master.model';
import { CountryMaster } from './country-master.model';
import { PreCustomerMaster } from './pre-customer-master.model';

@Table({ tableName: 'CustomerMaster', timestamps: false })
export class CustomerMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  CustomerMasterSid: number;

  @ForeignKey(() => CompanyMaster)
  @Column({ type: DataType.INTEGER })
  CompanyMasterSid: number;

  @ForeignKey(() => CountryMaster)
  @Column({ type: DataType.INTEGER })
  CountryMasterSid: number;

  @ForeignKey(() => PreCustomerMaster)
  @Column({ type: DataType.INTEGER })
  PreCustomerMasterSid: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  CustomerName: string;

  @Column({ type: DataType.STRING(50) })
  CustomerShortCode: string;

  @Column({ type: DataType.STRING(100) })
  CustomerAliasName: string;

  @Column({ type: DataType.STRING(20) })
  Registered: string;

  @Column({ type: DataType.STRING(20) })
  CompanyType: string;

  @Column({ type: DataType.STRING(20) })
  PanVatNo: string;

  @Column({ type: DataType.STRING(100) })
  PanName: string;

  @Column({ type: DataType.STRING(20) })
  CINNo: string;

  @Column({ type: DataType.STRING(6) })
  CashCredit: string;

  @Column({ type: DataType.STRING(20) })
  GroupName: string;

  @Column({ type: DataType.STRING(20) })
  Network: string;

  @Column({ type: DataType.STRING(50) })
  Website: string;

  @Column({ type: DataType.CHAR(1) })
  IsMSME: string;

  @Column({ type: DataType.STRING(100) })
  Remarks: string;

  @Column({ type: DataType.STRING(20) })
  RegistrationNo: string;

  @Column({ type: DataType.INTEGER })
  LoginSid: number;

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

  @BelongsTo(() => CountryMaster)
  country: CountryMaster;

  @BelongsTo(() => PreCustomerMaster)
  precustomer: PreCustomerMaster;
}
