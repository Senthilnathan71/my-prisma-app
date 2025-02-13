import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { CityMaster } from './city-master.model';
import { StateMaster } from './state-master.model';
import { CountryMaster } from './country-master.model';
import { BranchMaster } from './branch-master.model';
import { ChargeTaxMaster } from './charge-tax-master.model';

@Table({ tableName: 'CompanyMaster', timestamps: false })
export class CompanyMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  CompanyMasterSid: number;

  @ForeignKey(() => CityMaster)
  @Column({ type: DataType.INTEGER })
  CityMasterSid: number;

  @ForeignKey(() => StateMaster)
  @Column({ type: DataType.INTEGER })
  StateMasterSid: number;

  @ForeignKey(() => CountryMaster)
  @Column({ type: DataType.INTEGER })
  CountryMasterSid: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  CompanyName: string;

  @Column({ type: DataType.STRING(10), allowNull: false })
  CompanyCode: string;

  @Column({ type: DataType.STRING(500) })
  AddressLine1: string;

  @Column({ type: DataType.STRING(500) })
  AddressLine2: string;

  @Column({ type: DataType.STRING(10) })
  Postal_code: string;

  @Column({ type: DataType.STRING(100) })
  WebSite: string;

  @Column({ type: DataType.STRING(20) })
  PhoneNumber: string;

  @Column({ type: DataType.STRING(100) })
  Email: string;

  @Column({ type: DataType.CHAR(1) })
  isHo: string;

  @Column({ type: DataType.STRING(500) })
  Remarks: string;

  @Column({ type: DataType.BLOB })
  CompanyLogo: Buffer;

  @Column({ type: DataType.BLOB })
  ReportLogo: Buffer;

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


  //Relations 

  @BelongsTo(() => CityMaster)
  city: CityMaster;

  @BelongsTo(() => StateMaster)
  state: StateMaster;

  @BelongsTo(() => CountryMaster)
  country: CountryMaster;

  @HasMany(() => BranchMaster)
  branches: BranchMaster[];

  @HasMany(()=> ChargeTaxMaster)
  chargeTax : ChargeTaxMaster[];
}
