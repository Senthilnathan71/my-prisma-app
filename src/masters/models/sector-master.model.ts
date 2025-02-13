import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'SectorMaster', timestamps: false })
export class SectorMaster extends Model<SectorMaster> {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    sectorMasterSid!: number;

    @Column({ type: DataType.STRING(50), allowNull: false })
    sectorName!: string;

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
