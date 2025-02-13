import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { CountryMaster } from './country-master.model';
import { UserMaster } from './user-master.model';
import { CompanyMaster } from './company-master.model';
import { BranchMaster } from './branch-master.model';

@Table({ tableName: 'UserBranch', timestamps: false })

export class UserBranch extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  UserBranchMasterSid: number;

  @ForeignKey(() => UserMaster)
  @Column({ type: DataType.INTEGER })
  UserMasterSid: number;

  @ForeignKey(() => CompanyMaster)
  @Column({ type: DataType.INTEGER })
  CompanyMasterSid: number;

  @ForeignKey(() => BranchMaster)
  @Column({ type: DataType.INTEGER })
  BranchMasterSid: number;

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

  @BelongsTo(() => UserMaster)
  user: UserMaster;

  @BelongsTo(() => CompanyMaster)
  company: CompanyMaster;

  @BelongsTo(() => BranchMaster)
  branch: BranchMaster;

}