import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { StateMaster } from './state-master.model';
import { CountryMaster } from './country-master.model';

@Table({ tableName: 'CityMaster', timestamps: false })
export class CityMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  CityMasterSid: number;

  @Column({ type: DataType.CHAR(2), allowNull: false })
  CityCode: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  CityName: string;

  @ForeignKey(() => StateMaster)
  @Column({ type: DataType.INTEGER })
  StateMasterSid: number;

  @ForeignKey(() => CountryMaster)
  @Column({ type: DataType.INTEGER })
  CountryMasterSid: number;

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

  @BelongsTo(() => StateMaster)
  state: StateMaster;

  @BelongsTo(() => CountryMaster)
  country: CountryMaster;
}
