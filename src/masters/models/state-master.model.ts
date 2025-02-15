import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { CountryMaster } from './country-master.model';
import { CityMaster } from './city-master.model';
import { PortMaster } from './port-master.model';

@Table({ tableName: 'StateMaster', timestamps: true })
export class StateMaster extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  StateMasterSid: number;

  @Column({ type: DataType.CHAR(2), allowNull: false })
  StateCode: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  StateName: string;

  @Column({ type: DataType.CHAR(5) })
  StateGSTCode: string;

  @ForeignKey(() => CountryMaster)
  @Column({ type: DataType.INTEGER })
  CountryMasterSid: number;

  @Column({ type: DataType.INTEGER })
  LoginSid: number;

  @Column({ type: DataType.STRING(100) })
  CreatedBy: string;

  @Column({ type: DataType.STRING(100) })
  UpdatedBy: string;

  @Column({ type: DataType.CHAR(1) })
  Status: string;




  @BelongsTo(() => CountryMaster)
  country: CountryMaster;

  @HasMany(() => CityMaster)
  cities: CityMaster[];

  @HasMany(() => PortMaster)
  ports!: PortMaster[];
}
