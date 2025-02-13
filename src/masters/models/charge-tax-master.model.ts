import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { CompanyMaster } from './company-master.model';

@Table({ tableName: 'ChargeTaxMaster', timestamps: false })
export class ChargeTaxMaster extends Model<ChargeTaxMaster> {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    chargeTaxMasterSid!: number;

    @ForeignKey(() => CompanyMaster)
    @Column({ type: DataType.INTEGER })
    companyMasterSid!: number;

    @Column({ type: DataType.STRING(10), allowNull: false })
    hsnCode!: string;

    @Column({ type: DataType.STRING(100), allowNull: false })
    description!: string;

    @Column({ type: DataType.STRING(10) })
    taxGroup!: string;

    @Column({ type: DataType.DECIMAL(4,2) })
    taxRate!: number;

    @Column({ type: DataType.DATE })
    createdOn!: Date;

    @Column({ type: DataType.STRING(100) })
    createdBy!: string;

    @Column({ type: DataType.DATE })
    updatedOn!: Date;

    @Column({ type: DataType.STRING(100) })
    updatedBy!: string;

    @Column({ type: DataType.STRING(100) })
    remarks!: string;

    @Column({ type: DataType.CHAR(1) })
    status!: string;

    @BelongsTo(() => CompanyMaster)
    company!: CompanyMaster;
}