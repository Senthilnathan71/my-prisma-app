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
  /**
   * Column on the document that stores its own menu. When set, the scan matches it to
   * the authority rule's menu so a document is only listed under the menu it truly
   * belongs to (e.g. an Air-Waybill House Job is not shown under the House Job menu).
   */
  menuMasterField?: string;
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
    menuMasterField: 'MenuMasterSid',
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
    menuMasterField: 'MenuMasterSid',
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
    menuMasterField: 'MenuMasterSid',
    linkPattern: '/operation/booking/entry/{id}',
  },
  {
    // houseJob table also backs Service Job (IsServiceJob='Y') and House Air Waybill —
    // each is a distinct MENU on the same table, separated by the MenuMasterSid filter.
    menuKeys: [
      'house job', 'housejob',
      'service job', 'servicejob',
      'house air waybill', 'house airway bill', 'hawb',
    ],
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
    submittedDateField: 'HBLDate',
    menuMasterField: 'MenuMasterSid',
    linkPattern: '/operation/house-job/entry/{id}',
  },
  {
    // masterJob table also backs Master Air Waybill and Agent Master Air Waybill —
    // distinct MENUs on the same table, separated by the MenuMasterSid filter.
    // No status column, PascalCase audit columns, no customer.
    menuKeys: [
      'master job', 'masterjob',
      'master air waybill', 'master airway bill', 'mawb',
      'agent master air waybill', 'agent master airway bill', 'amawb',
    ],
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
    menuMasterField: 'MenuMasterSid',
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

/**
 * Navigation routes keyed by MENU name. Kept separate from the document model
 * because several menus share one table but open different screens (e.g. House Job,
 * Service Job and House Air Waybill all live in `houseJob` but have distinct routes;
 * every voucher menu lives in `voucherHeader` but opens its own screen).
 */
const MENU_ROUTE_MAP: Record<string, string> = {
  // CRM / Operation documents
  quotation: '/crm/quotation/entry/{id}',
  enquiry: '/crm/enquiry/entry/{id}',
  booking: '/operation/booking/entry/{id}',
  'house job': '/operation/house-job/entry/{id}',
  'service job': '/operation/service-job/entry/{id}',
  'house air waybill': '/operation/hawb-bill/entry/{id}',
  'master job': '/operation/master-job/entry/{id}',
  'master air waybill': '/operation/mawbill/entry/{id}',
  'agent master air waybill': '/operation/agent-master-air-waybill/entry/{id}',
  // Voucher documents (all VoucherHeader, different screens per type)
  invoice: '/operation/invoice/entry/{id}',
  'credit note': '/operation/credit-note/entry/{id}',
  'vendor invoice': '/operation/vendor-invoice/entry/{id}',
  'vendor credit note': '/operation/vendor-credit-note/entry/{id}',
  'journal voucher': '/accounts/journal-voucher/entry/{id}',
  'reverse voucher': '/accounts/reverse-voucher/entry/{id}',
  payment: '/accounts/payment/entry/{id}',
  receipt: '/accounts/receipt/entry/{id}',
  'invoice non job': '/accounts/invoice-non-job/entry/{id}',
  'credit note non job': '/accounts/credit-note-non-job/entry/{id}',
};

/** Build the "open document" route for a menu, or '' when no route is known. */
export function resolveMenuRoute(menuName: string | null | undefined, docSid: number | string): string {
  const pattern = MENU_ROUTE_MAP[norm(menuName)];
  return pattern ? pattern.replace('{id}', String(docSid)) : '';
}
