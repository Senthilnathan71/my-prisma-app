import { Table, Column, Model, DataType, ForeignKey, BelongsTo, BelongsToMany } from 'sequelize-typescript';
import { CompanyMaster } from './company-master.model';
import { CityMaster } from './city-master.model';
import { UserMaster } from './user-master.model';
import { UserBranch } from './user-branch-master.model';

@Table({ tableName: 'BranchMaster', timestamps: false })
export class BranchMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  BranchMasterSid: number;

  @ForeignKey(() => CompanyMaster)
  @Column({ type: DataType.INTEGER })
  CompanyMasterSid: number;

  @ForeignKey(() => CityMaster)
  @Column({ type: DataType.INTEGER })
  CityMasterSid: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  BranchName: string;

  @Column({ type: DataType.STRING(100) })
  AddressLine1: string;

  @Column({ type: DataType.STRING(100) })
  AddressLine2: string;

  @Column({ type: DataType.STRING(100) })
  PhoneNumber: string;

  @Column({ type: DataType.STRING(100) })
  Email: string;

  @Column({ type: DataType.CHAR(1) })
  Status: string;

  @BelongsTo(() => CompanyMaster)
  company: CompanyMaster;

  @BelongsTo(() => CityMaster)
  city: CityMaster;

  @BelongsToMany(() => UserMaster, () => UserBranch) // Many-to-many relation
  users: UserMaster[];
}
