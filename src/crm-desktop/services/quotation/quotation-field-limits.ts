import { BadRequestException } from '@nestjs/common';

/**
 * Character-length guards for the quotation write path.
 *
 * These numbers MIRROR the `@db.VarChar(...)` / `@db.Char(...)` lengths declared for the
 * QuoteHeader / QuoteRoute / QuoteCargo / QuoteProduct / QuoteCarrier / QuoteCharge models in
 * `prisma/schema/company.prisma`. They are kept HERE (in code) — not enforced by adding new DB
 * constraints — so that an over-length value is rejected up front with a clear, field-named
 * message instead of reaching Postgres and coming back as a generic `22001 / P2000` truncation
 * error that the controller surfaces to the user as "Internal Server Error".
 *
 * IMPORTANT: if a column length is ever changed in the schema, update the matching number here.
 * The keys are the PAYLOAD field names sent by the Angular quotation form (not the DB columns,
 * though they happen to match today).
 */

type FieldLimit = { max: number; label: string };
type LimitMap = Record<string, FieldLimit>;

// QuoteHeader (top-level payload)
const HEADER_LIMITS: LimitMap = {
  CustomerName: { max: 100, label: 'Customer Name' },
  CustomerAddress: { max: 300, label: 'Customer Address' },
  Remarks: { max: 100, label: 'Remarks' },
  CustomerRef: { max: 20, label: 'Customer Ref' },
  Email: { max: 200, label: 'Email' },
  ContactPerson: { max: 30, label: 'Contact Person' },
  ContactNumber: { max: 20, label: 'Contact Number (incl. dial code)' },
  ClearanceBy: { max: 200, label: 'Clearance By' },
  TransportBy: { max: 200, label: 'Transport By' },
  FreightPPCC: { max: 10, label: 'Freight PP/CC' },
  AuthorizerRemarks: { max: 100, label: 'Authorizer Remarks' },
  CustomerApprovedBy: { max: 20, label: 'Customer Approved By' },
};

// QuoteRoute (payload.quoteRoutes[])
// NB: route-level CargoType is a legacy column and is NOT persisted on create (cargo now carries
// its own CargoType, validated below), so it is intentionally not checked here.
const ROUTE_LIMITS: LimitMap = {
  Remarks: { max: 100, label: 'Remarks' },
  ServiceLevel: { max: 10, label: 'Inco Terms / Service Level' },
  segmentType: { max: 20, label: 'Segment Type' },
  FreightPPCC: { max: 10, label: 'Freight PP/CC' },
};

// QuoteCargo (route.quoteCargo[])
const CARGO_LIMITS: LimitMap = {
  CargoType: { max: 10, label: 'Cargo Type' },
  ContainerType: { max: 10, label: 'Container Type' },
  ShipmentTerms: { max: 10, label: 'Shipment Terms' },
  PackageType: { max: 5, label: 'Package Type' },
  // (cargo-level ProductName is a legacy column not written on create — products carry their own.)
  CargoDescription: { max: 200, label: 'Cargo Description' },
};

// QuoteProduct (cargo.quoteProducts[])
const PRODUCT_LIMITS: LimitMap = {
  ProductName: { max: 20, label: 'Commodity / Product Name' },
  PackageType: { max: 5, label: 'Package Type' },
  CargoDescription: { max: 100, label: 'Cargo Description' },
  Remarks: { max: 200, label: 'Remarks' },
};

// QuoteCarrier (route.quoteCarriers[])
const CARRIER_LIMITS: LimitMap = {
  CarrierName: { max: 100, label: 'Carrier Name' },
  ApprovedBy: { max: 20, label: 'Approved By' },
  Remarks: { max: 100, label: 'Authorizer Remarks' },
  authorizerRemarks: { max: 100, label: 'Authorizer Remarks' },
};

// QuoteCharge (carrier.quoteCharges[])
const CHARGE_LIMITS: LimitMap = {
  ChargeDisplayName: { max: 50, label: 'Charge Name' },
  Remarks: { max: 100, label: 'Charge Remarks' },
  CostPrepaidCollect: { max: 10, label: 'Cost PP/CC' },
  RevenuePrepaidCollect: { max: 10, label: 'Revenue PP/CC' },
};

function checkLimits(section: string, record: any, limits: LimitMap, where = ''): void {
  if (!record) return;
  for (const field of Object.keys(limits)) {
    const value = record[field];
    // Only validate strings that are actually present. null/undefined/numbers/booleans map to
    // non-VarChar columns or are absent, so they cannot trip the truncation error.
    if (value === null || value === undefined) continue;
    const text = String(value);
    if (text.length > limits[field].max) {
      const location = where ? ` [${where}]` : '';
      throw new BadRequestException(
        `${section} → "${limits[field].label}" must be at most ${limits[field].max} characters` +
        `${location}. You entered ${text.length}.`,
      );
    }
  }
}

/**
 * Walks the whole quotation payload (header → routes → carriers → charges, and
 * routes → cargo → products) and throws a `BadRequestException` on the FIRST field that exceeds
 * its column length. Call this BEFORE any DB write and OUTSIDE the service try/catch so the
 * BadRequestException reaches the controller unwrapped (the controller then returns
 * `error.message`, which is the clear message built here).
 */
export function validateQuotationPayloadLengths(payload: any): void {
  if (!payload) return;

  checkLimits('Quotation', payload, HEADER_LIMITS);

  const routes = Array.isArray(payload.quoteRoutes) ? payload.quoteRoutes : [];
  routes.forEach((route: any, ri: number) => {
    const routeRef = `Route ${ri + 1}`;
    checkLimits('Route', route, ROUTE_LIMITS, routeRef);

    const carriers = route?.quoteCarriers || route?.quoteCarrier || [];
    (Array.isArray(carriers) ? carriers : []).forEach((carrier: any, ci: number) => {
      const carrierRef = `${routeRef} · Carrier ${ci + 1}`;
      checkLimits('Carrier', carrier, CARRIER_LIMITS, carrierRef);

      const charges = carrier?.quoteCharges || carrier?.quoteCharge || [];
      (Array.isArray(charges) ? charges : []).forEach((charge: any, chi: number) => {
        checkLimits('Charge', charge, CHARGE_LIMITS, `${carrierRef} · Charge ${chi + 1}`);
      });
    });

    const cargoGroups = route?.quoteCargo || [];
    (Array.isArray(cargoGroups) ? cargoGroups : []).forEach((cargo: any, cgi: number) => {
      const cargoRef = `${routeRef} · Cargo ${cgi + 1}`;
      checkLimits('Cargo', cargo, CARGO_LIMITS, cargoRef);

      const products = cargo?.quoteProducts || cargo?.quoteProduct || cargo?.products || [];
      (Array.isArray(products) ? products : []).forEach((product: any, pi: number) => {
        checkLimits('Product', product, PRODUCT_LIMITS, `${cargoRef} · Product ${pi + 1}`);
      });
    });
  });
}
