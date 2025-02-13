import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { CountryMaster } from './country-master.model';
import { StateMaster } from './state-master.model';
// import { SectorMaster } from './SectorMaster';

@Table({ tableName: 'PortMaster', timestamps: false })
export class PortMaster extends Model<PortMaster> {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    portMasterSid!: number;

    @ForeignKey(() => CountryMaster)
    @Column({ type: DataType.INTEGER })
    countryMasterSid!: number;

    @ForeignKey(() => StateMaster)
    @Column({ type: DataType.INTEGER })
    stateMasterSid!: number;

    // @ForeignKey(() => SectorMaster)
    // @Column({ type: DataType.INTEGER })
    // sectorMasterSid!: number;

    @Column({ type: DataType.STRING(5), allowNull: false })
    portCode!: string;

    @Column({ type: DataType.STRING(50), allowNull: false })
    portName!: string;

    @Column({ type: DataType.STRING(10) })
    timeZone!: string;

    @Column({ type: DataType.STRING(10) })
    ediPortCode!: string;

    @Column({ type: DataType.STRING(100) })
    exportRestriction!: string;

    @Column({ type: DataType.STRING(100) })
    importRestriction!: string;

    @Column({ type: DataType.STRING(10) })
    portType!: string;

    @Column({ type: DataType.STRING(10) })
    terminalCode!: string;

    @Column({ type: DataType.STRING(100) })
    remarks!: string;

    @Column({ type: DataType.CHAR(1) })
    cbmRequire!: string;

    @Column({ type: DataType.STRING(10) })
    scmtPortCode!: string;

    @Column({ type: DataType.DATE })
    createdOn!: Date;

    @Column({ type: DataType.STRING(100) })
    createdBy!: string;

    @Column({ type: DataType.DATE })
    updatedOn!: Date;

    @Column({ type: DataType.STRING(100) })
    updatedBy!: string;

    @Column({ type: DataType.INTEGER })
    loginSid!: number;

    @Column({ type: DataType.CHAR(1) })
    status!: string;

    @BelongsTo(() => CountryMaster)
    country!: CountryMaster;

    @BelongsTo(() => StateMaster)
    state!: StateMaster;

    // @BelongsTo(() => SectorMaster)
    // sector!: SectorMaster;
}
