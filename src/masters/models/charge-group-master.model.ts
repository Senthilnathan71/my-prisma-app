import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'ChargeGroup', timestamps: false })
export class ChargeGroup extends Model<ChargeGroup> {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    chargeGroupSid!: number;

    @Column({ type: DataType.STRING(50), allowNull: false })
    chargeGroupName!: string;

    @Column({ type: DataType.STRING(10) })
    chargeGroupCode!: string;

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