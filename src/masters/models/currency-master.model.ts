import { Table, Column, Model, ForeignKey, BelongsTo, DataType } from 'sequelize-typescript';
import { CountryMaster } from './country-master.model';

@Table({ tableName: 'CurrencyMaster', timestamps: false })
export class CurrencyMaster extends Model<CurrencyMaster> {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    currencyMasterSid!: number;

    @ForeignKey(() => CountryMaster)
    @Column({ type: DataType.INTEGER })
    countryMasterSid!: number;
    
    @Column({ type: DataType.CHAR(3), allowNull: false })
    currencyCode!: string;

    @Column({ type: DataType.STRING(100), allowNull: false })
    currencyName!: string;

    @Column({ type: DataType.CHAR(1) })
    currencyID!: string;

    @Column({ type: DataType.STRING(50) })
    currencyFirstName!: string;

    @Column({ type: DataType.STRING(50) })
    currencyLastName!: string;

    @Column({ type: DataType.INTEGER })
    currencyRatio!: number;

    @Column({ type: DataType.INTEGER })
    amountDecimal!: number;

    @Column({ type: DataType.INTEGER })
    exchangeDecimal!: number;

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
}
