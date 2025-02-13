import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, BelongsToMany } from 'sequelize-typescript';
import { CountryMaster } from './country-master.model';
import { UserBranch } from './user-branch-master.model';
import { BranchMaster } from './branch-master.model';

@Table({ tableName: 'UserMaster', timestamps: false })
export class UserMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  UserMasterSid: number;

  @ForeignKey(() => CountryMaster)
  @Column({ type: DataType.INTEGER })
  CountryMasterSid: number;

  @Column({ type: DataType.CHAR(3), allowNull: false })
  UserCode: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  UserName: string;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  UserEmail: string;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  UserLogin: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  UserPassword: string;

  @Column({ type: DataType.CHAR(1) })
  Issalesperson: string;

  @Column({ type: DataType.STRING(20) })
  ContactNumber: string;

  @Column({ type: DataType.STRING(20) })
  Department: string;

  @Column({ type: DataType.STRING(20) })
  Designation: string;

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

  @BelongsTo(() => CountryMaster)
  country: CountryMaster;

  @HasMany(()=> UserBranch)
  userBranch : UserBranch []

  // Add this association to get branch details through userBranch table
  @BelongsToMany(() => BranchMaster, () => UserBranch)
  branches: BranchMaster[];
}
