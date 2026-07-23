/**
 * Approval Document Registry
 * --------------------------------------------------------------------------
 * The Authorization Approval screen scans a DIFFERENT table for each menu. Those
 * tables do NOT share a common shape, so this registry describes, per document
 * model, which columns to read and HOW "pending" is decided.
 *
 * Two pending modes:
 *  - 'statusField' : the doc has an `authorizerStatus` column (Quotation, Enquiry,
 *                    Booking, House Job). Pending = status not Approved/Rejected.
 *  - 'logOnly'     : the doc has NO status column (Master Job, and all VoucherHeader
 *                    menus: Invoice, Credit Note, Journal Voucher, Vendor Invoice,
 *                    Payment, Receipt...). Pending is decided purely from AuthorityLog:
 *                    not finalized (no FinalAuthority-Approved, no Rejected) and not
 *                    acted on by this user. Vouchers are additionally restricted to
 *                    unposted rows (PostStatus='U') to exclude posted history.
 *
 * Resolution is by the DB `MenuConfig.ModelName` first (accurate), then the menu name.
 * Voucher menus are detected dynamically (VoucherTypeMaster.MenuMasterSid) in the
 * service and assigned the shared voucher source via getVoucherDocSource().
 */

export type PendingMode = 'statusField' | 'logOnly';

export interface ApprovalDocSource {
  /** camelCase Prisma delegate name, e.g. 'quoteHeader'. */
  model: string;
  primaryKey: string;
  pendingMode: PendingMode;
  /** ApprovalStatus enum column — required for 'statusField' mode only. */
  statusField?: string;
  /** Soft-delete flag column ('status' camelCase or 'Status' PascalCase). */
  softDeleteField: string;
  docNoFields: string[];
  customerNameField?: string;
  customerSidField?: string;
  companyField: string;
  branchField: string;
  departmentField: string;
  submittedByField: string;
  submittedDateField: string;
  linkPattern: string;
  /** logOnly: restrict VoucherHeader rows to the menu via VoucherTypeMaster.MenuMasterSid. */
  voucherTypeMenuScope?: boolean;
  /** logOnly: only rows with this posting status are candidates (e.g. PostStatus='U'). */
  postStatusField?: string;
  postStatusPendingValue?: string;
}

interface RegisteredSource extends ApprovalDocSource {
  menuKeys: string[];
  modelKeys: string[];
}

const SOURCES: RegisteredSource[] = [
  {
    menuKeys: ['quotation', 'quote'],
    modelKeys: ['quoteheader', 'quotation'],
    model: 'quoteHeader',
    primaryKey: 'QuoteHeaderSid',
    pendingMode: 'statusField',
    statusField: 'authorizerStatus',
    softDeleteField: 'status',
    docNoFields: ['QuoteNumber'],
    customerNameField: 'CustomerName',
    customerSidField: 'CustomerMasterSid',
    companyField: 'CompanyMasterSid',
    branchField: 'BranchMasterSid',
    departmentField: 'DepartmentMasterSid',
    submittedByField: 'createdBy',
    submittedDateField: 'QuoteDate',
    linkPattern: '/crm/quotation/entry/{id}',
  },
  {
    menuKeys: ['enquiry', 'inquiry'],
    modelKeys: ['enquiryheader', 'enquiry'],
    model: 'enquiryHeader',
    primaryKey: 'EnquiryHeaderSid',
    pendingMode: 'statusField',
    statusField: 'authorizerStatus',
    softDeleteField: 'status',
    docNoFields: ['EnquiryNumber'],
    customerNameField: 'CustomerName',
    customerSidField: 'CustomerMasterSid',
    companyField: 'CompanyMasterSid',
    branchField: 'BranchMasterSid',
    departmentField: 'DepartmentMasterSid',
    submittedByField: 'createdBy',
    submittedDateField: 'EnquiryDate',
    linkPattern: '/crm/enquiry/entry/{id}',
  },
  {
    menuKeys: ['booking'],
    modelKeys: ['bookingheader', 'booking'],
    model: 'bookingHeader',
    primaryKey: 'BookingHeaderSid',
    pendingMode: 'statusField',
    statusField: 'authorizerStatus',
    softDeleteField: 'status',
    docNoFields: ['BookingNo'],
    customerNameField: 'CustomerName',
    customerSidField: 'CustomerMasterSid',
    companyField: 'CompanyMasterSid',
    branchField: 'BranchMasterSid',
    departmentField: 'DepartmentMasterSid',
    submittedByField: 'createdBy',
    submittedDateField: 'BookingDateTime',
    linkPattern: '/operation/booking/entry/{id}',
  },
  {
    menuKeys: ['house job', 'housejob'],
    modelKeys: ['housejob'],
    model: 'houseJob',
    primaryKey: 'HouseJobSid',
    pendingMode: 'statusField',
    statusField: 'authorizerStatus',
    softDeleteField: 'status',
    docNoFields: ['HouseNo', 'HBLNo', 'BookingNo', 'ShipmentNo'],
    customerNameField: 'CustomerName',
    customerSidField: 'CustomerMasterSid',
    companyField: 'CompanyMasterSid',
    branchField: 'BranchMasterSid',
    departmentField: 'DepartmentMasterSid',
    submittedByField: 'createdBy',
    submittedDateField: 'createdOn',
    linkPattern: '/operation/house-job/entry/{id}',
  },
  {
    // Master Job — no status column, PascalCase audit columns, no customer.
    menuKeys: ['master job', 'masterjob'],
    modelKeys: ['masterjob'],
    model: 'masterJob',
    primaryKey: 'MasterJobSid',
    pendingMode: 'logOnly',
    softDeleteField: 'Status',
    docNoFields: ['MasterJobNumber'],
    companyField: 'CompanyMasterSid',
    branchField: 'BranchMasterSid',
    departmentField: 'DepartmentMasterSid',
    submittedByField: 'CreatedBy',
    submittedDateField: 'MasterJobDate',
    linkPattern: '/operation/master-job/entry/{id}',
  },
  {
    // VoucherHeader — shared by all accounting menus, scoped by VoucherType->Menu.
    menuKeys: [
      'invoice',
      'invoice non job',
      'credit note',
      'journal voucher',
      'vendor invoice',
      'vendor credit note',
      'payment',
      'receipt',
      'reverse voucher',
      'voucher matching',
    ],
    modelKeys: ['voucherheader', 'voucher'],
    model: 'voucherHeader',
    primaryKey: 'VoucherHeaderSid',
    pendingMode: 'logOnly',
    softDeleteField: 'Status',
    docNoFields: ['VoucherNumber', 'DocumentNumber'],
    customerNameField: 'PartyName',
    customerSidField: 'PartyMasterSid',
    companyField: 'CompanyMasterSid',
    branchField: 'BranchMasterSid',
    departmentField: 'DepartmentMasterSid',
    submittedByField: 'CreatedBy',
    submittedDateField: 'VoucherDate',
    linkPattern: '',
    voucherTypeMenuScope: true,
    postStatusField: 'PostStatus',
    postStatusPendingValue: 'U',
  },
];

const byMenu = new Map<string, ApprovalDocSource>();
const byModel = new Map<string, ApprovalDocSource>();
for (const s of SOURCES) {
  s.menuKeys.forEach((k) => byMenu.set(k, s));
  s.modelKeys.forEach((k) => byModel.set(k, s));
}

const norm = (v?: string | null) => String(v || '').trim().toLowerCase();

/**
 * Resolve the document source for a menu. Prefers the DB MenuConfig.ModelName
 * (environment-accurate), then falls back to the menu name.
 */
export function resolveApprovalDocSource(
  menuName?: string | null,
  modelName?: string | null,
): ApprovalDocSource | undefined {
  const m = norm(modelName);
  if (m && byModel.has(m)) return byModel.get(m);
  const n = norm(menuName);
  if (n && byMenu.has(n)) return byMenu.get(n);
  return undefined;
}

/** The shared VoucherHeader source, assigned to any voucher-type menu. */
export function getVoucherDocSource(): ApprovalDocSource | undefined {
  return byModel.get('voucherheader');
}
