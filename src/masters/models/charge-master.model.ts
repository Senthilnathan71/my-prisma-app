import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { ChargeGroup } from './charge-group-master.model';
import { DepartmentMaster } from './department-master.model';
import { UnitMaster } from './unit-master.model';
import { CompanyMaster } from './company-master.model';
import { CurrencyMaster } from './currency-master.model';


@Table({ tableName: 'ChargeMaster', timestamps: false })
export class ChargeMaster extends Model<ChargeMaster> {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    chargeMasterSid!: number;

    @ForeignKey(() => CompanyMaster)
    @Column({ type: DataType.INTEGER })
    CompanyMasterSid!: number;

    @ForeignKey(() => ChargeGroup)
    @Column({ type: DataType.INTEGER })
    chargeGroupSid!: number;

    @ForeignKey(() => DepartmentMaster)
    @Column({ type: DataType.INTEGER })
    DepartmentMasterSid!: number;

    @ForeignKey(() => UnitMaster)
    @Column({ type: DataType.INTEGER })
    unitMasterSid!: number;

    @ForeignKey(() => CurrencyMaster)
    @Column({ type: DataType.INTEGER })
    currencyMasterSid!: number;

    @Column({ type: DataType.STRING(50), allowNull: false })
    chargeName!: string;

    @Column({ type: DataType.STRING(10) })
    chargeCode!: string;

    @Column({ type: DataType.STRING(100) })
    remarks!: string;

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





    @BelongsTo(() => ChargeGroup)
    chargeGroup!: ChargeGroup;

    @BelongsTo(() => DepartmentMaster)
    department!: DepartmentMaster;

    @BelongsTo(() => UnitMaster)
    unit!: UnitMaster;

    @BelongsTo(() => CompanyMaster)
    company!: UnitMaster;

    @BelongsTo(() => CurrencyMaster)
    currency!: UnitMaster;
}
