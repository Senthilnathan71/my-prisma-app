import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { CustomerMaster } from './customer-master.model';
import { CompanyMaster } from './company-master.model';
import { StateMaster } from './state-master.model';
import { CityMaster } from './city-master.model';

@Table({ tableName: 'CustomerBranch', timestamps: false })
export class CustomerBranch extends Model<CustomerBranch> {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    customerBranchSid!: number;

    @ForeignKey(() => CustomerMaster)
    @Column({ type: DataType.INTEGER })
    customerMasterSid!: number;

    @BelongsTo(() => CustomerMaster)
    customer!: CustomerMaster;

    @ForeignKey(() => CompanyMaster)
    @Column({ type: DataType.INTEGER })
    companyMasterSid!: number;

    @BelongsTo(() => CompanyMaster)
    company!: CompanyMaster;

    @ForeignKey(() => StateMaster)
    @Column({ type: DataType.INTEGER })
    stateMasterSid!: number;

    @BelongsTo(() => StateMaster)
    state!: StateMaster;

    @ForeignKey(() => CityMaster)
    @Column({ type: DataType.INTEGER })
    cityMasterSid!: number;

    @BelongsTo(() => CityMaster)
    city!: CityMaster;

    @Column({ type: DataType.STRING(20) })
    branchName!: string;

    @Column({ type: DataType.STRING(10) })
    zipPostBox!: string;

    @Column({ type: DataType.STRING(20) })
    tanNo!: string;

    @Column({ type: DataType.STRING(200) })
    address!: string;

    @Column({ type: DataType.STRING(200) })
    email!: string;

    @Column({ type: DataType.CHAR(1) })
    registered!: string;

    @Column({ type: DataType.STRING(10) })
    customerGstType!: string;

    @Column({ type: DataType.STRING(10) })
    vendorGstType!: string;

    @Column({ type: DataType.STRING(15) })
    gstNo!: string;

    @Column({ type: DataType.STRING(20) })
    contactNo!: string;

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
