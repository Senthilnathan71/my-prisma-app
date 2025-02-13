import { Table, Column, Model, ForeignKey, BelongsTo, DataType } from 'sequelize-typescript';

@Table({ tableName: 'UnitMaster', timestamps: false })
export class UnitMaster extends Model<UnitMaster> {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    unitMasterSid!: number;

    @Column({ type: DataType.STRING(50), allowNull: false })
    unitName!: string;

    @Column({ type: DataType.STRING(10) })
    unitCode!: string;

    @Column({ type: DataType.STRING(5) })
    unitSymbol!: string;

    @Column({ type: DataType.STRING(10) })
    jobType!: string;

    @Column({ type: DataType.STRING(10) })
    measurementType!: string;
 
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
}