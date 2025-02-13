import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { StateMaster } from './state-master.model';
import { CompanyMaster } from './company-master.model';
import { PortMaster } from './port-master.model';

@Table({ tableName: 'CountryMaster', timestamps: false })
export class CountryMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  CountryMasterSid: number;

  @Column({ type: DataType.CHAR(2), allowNull: false })
  CountryCode: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  CountryName: string;

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


  @HasMany(() => StateMaster)
  states: StateMaster[];

  @HasMany(() => CompanyMaster)
  companies: CompanyMaster[];

  @HasMany(() => PortMaster)
  ports!: PortMaster[];
}
