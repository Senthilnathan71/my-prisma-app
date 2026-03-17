/**
 * Helper functions for formatting data in PDF documents
 * Copied from frontend: ng-freight-forwarding/src/app/common/pdf/helpers/pdf-formatters.ts
 */

/**
 * Format a date to DD/MM/YYYY string
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format a date to DD-MMM-YYYY string (e.g., 01-Jan-2024)
 */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

/**
 * Format a date with time to DD/MM/YYYY HH:mm string
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format a number with specified decimal places
 */
export function formatNumber(value: any, decimals: number = 0): string {
  if (value === null || value === undefined || value === '') return '';

  const num = parseFloat(value);
  if (isNaN(num)) return '';

  return num.toFixed(decimals);
}

/**
 * Format a number with thousand separators
 */
export function formatNumberWithCommas(value: any, decimals: number = 2): string {
  if (value === null || value === undefined || value === '') return '';

  const num = parseFloat(value);
  if (isNaN(num)) return '';

  return num.toFixed(decimals);
}

/**
 * Format currency with symbol and thousand separators
 */
export function formatCurrency(value: any, currencyCode: string = '', decimals: number = 2): string {
  if (value === null || value === undefined || value === '') return '';

  const num = parseFloat(value);
  if (isNaN(num)) return '';

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return currencyCode ? `${currencyCode} ${formatted}` : formatted;
}

/**
 * Get department name from department list by ID
 */
export function getDepartmentName(deptId: number | undefined, departments: any[]): string {
  if (!deptId || !departments || departments.length === 0) return '';
  const dept = departments.find(d => d.DepartmentMasterSid === deptId);
  return dept?.departmentName || '';
}

/**
 * Get port formatted string (PortName (PortCode))
 */
export function getFormattedPort(portId: number | undefined, ports: any[]): string {
  if (!portId || !ports || ports.length === 0) return '';
  const port = ports.find(p => p.PortMasterSid === portId);
  return port ? `${port.PortName} (${port.PortCode})` : '';
}

/**
 * Get port info object from port list
 */
export function getPortInfo(portId: number | undefined, ports: any[]): { portName: string; portCode: string } | null {
  if (!portId || !ports || ports.length === 0) return null;
  const port = ports.find(p => p.PortMasterSid === portId);
  return port ? { portName: port.PortName || '', portCode: port.PortCode || '' } : null;
}

/**
 * Get currency code from currency master by ID
 */
export function getCurrencyCode(currencyId: number | undefined, currencyMaster: any[]): string {
  if (!currencyId || !currencyMaster || currencyMaster.length === 0) return '';
  const currency = currencyMaster.find(c => c.CurrencyMasterSid === currencyId);
  return currency?.currencyCode || '';
}

/**
 * Get UOM code from charge unit master by ID
 */
export function getChargeUOMCode(uomId: number | undefined, chargeUnitMaster: any[]): string {
  if (!uomId || !chargeUnitMaster || chargeUnitMaster.length === 0) return '';
  const uom = chargeUnitMaster.find(u => u.UOMMasterSid === uomId);
  return uom?.UOMCode || '';
}

/**
 * Get container type name from container types list
 */
export function getContainerTypeName(containerTypeId: number | undefined, containerTypes: any[]): string {
  if (!containerTypeId || !containerTypes || containerTypes.length === 0) return '';
  const containerType = containerTypes.find(c => c.ContainerTypeSid === containerTypeId);
  return containerType?.ContainerType || containerType?.containerType || '';
}

/**
 * Get package type name from package types list
 */
export function getPackageTypeName(packageTypeId: number | undefined, packageTypes: any[]): string {
  if (!packageTypeId || !packageTypes || packageTypes.length === 0) return '';
  const packageType = packageTypes.find(p => p.PackageTypeSid === packageTypeId);
  return packageType?.PackageType || packageType?.packageType || '';
}

/**
 * Get customer name by ID
 */
export function getCustomerName(customerId: number | undefined, customers: any[]): string {
  if (!customerId || !customers || customers.length === 0) return '';
  const customer = customers.find(c => c.CustomerMasterSid === customerId);
  return customer?.CustomerName || customer?.customerName || '';
}

/**
 * Get user/salesman name by ID
 */
export function getUserName(userId: number | undefined, users: any[]): string {
  if (!userId || !users || users.length === 0) return '';
  const user = users.find(u => u.UserMasterSid === userId);
  return user?.userName || user?.UserName || '';
}

/**
 * Get carrier name by ID
 */
export function getCarrierName(carrierId: number | undefined, carriers: any[]): string {
  if (!carrierId || !carriers || carriers.length === 0) return '';
  const carrier = carriers.find(c => c.CarrierMasterSid === carrierId);
  return carrier?.CarrierName || carrier?.carrierName || '';
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Join non-empty strings with separator
 */
export function joinNonEmpty(values: (string | undefined | null)[], separator: string = ', '): string {
  return values.filter(v => v && v.trim()).join(separator);
}

/**
 * Get safe value or empty string
 */
export function safeValue(value: any, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

/**
 * Format address from multiple fields
 */
export function formatAddress(
  line1?: string,
  line2?: string,
  city?: string,
  postalCode?: string,
  country?: string
): string {
  const parts = [line1, line2, city, postalCode, country].filter(p => p && p.trim());
  return parts.join(', ');
}

/**
 * Calculate total from array of objects
 */
export function calculateTotal(items: any[], field: string): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
}

/**
 * Generate route label from POL, POD, FPD
 */
export function getRouteLabel(
  polPort: string | undefined,
  podPort: string | undefined,
  fpdPort?: string | undefined
): string {
  const parts = [polPort, podPort];
  if (fpdPort && fpdPort !== podPort) {
    parts.push(fpdPort);
  }
  return parts.filter(p => p).join(' - ');
}

/**
 * Convert boolean-like value to Yes/No
 */
export function toYesNo(value: any): string {
  if (value === true || value === 'Y' || value === 'Yes' || value === 1 || value === '1') {
    return 'Yes';
  }
  return 'No';
}

/**
 * Get FCL/LCL/AIR display name
 */
export function getShipmentModeLabel(mode: string): string {
  const modes: Record<string, string> = {
    'FCL': 'Full Container Load (FCL)',
    'LCL': 'Less than Container Load (LCL)',
    'AIR': 'Air Freight'
  };
  return modes[mode?.toUpperCase()] || mode || '';
}
