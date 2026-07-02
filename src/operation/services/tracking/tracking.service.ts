import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ShipmentMilestoneService } from 'src/operation/services/shipment-milestone/shipment-milestone.service';
import * as fs from 'fs';
import * as path from 'path';

type TrackingState = 'completed' | 'current' | 'pending' | 'exception';
type TrackingScope = 'BOOKING' | 'HOUSE' | 'MASTER' | 'CONTAINER';
type SearchType = 'booking' | 'hbl' | 'mbl' | 'job' | 'container';

interface TrackingMilestone {
  eventName: string;
  eventDate?: Date | null;
  eventTime?: string | null;
  location?: string | null;
  remarks?: string | null;
  state: TrackingState;
  source: string;
  sequence: number;
}

interface TrackingDocument {
  attachDocumentSid: number;
  documentName: string;
  documentType: string | null;
  documentNo: string | null;
  documentDate: Date | null;
  receivedDate: Date | null;
  sentDate: Date | null;
  source: 'BOOKING' | 'HOUSE';
  menuName: string | null;
  fileName: string;
  filePath: string;
  downloadUrl: string;
  isPublic: boolean;
  uploadedOn: Date | null;
}

interface TrackingContext {
  CompanyMasterSid?: number;
  BranchMasterSid?: number;
  CustomerMasterSid?: number;
  CustomerBranchSid?: number;
}

type ResolvedEntities =
  | { kind: 'not_found' }
  | { kind: 'multiple'; matches: any[] }
  | { kind: 'single'; booking: any; houseJob: any; masterJob: any; scope: TrackingScope };

// Sea milestone timeline (vessel / container events).
const SEA_EVENTS = [
  'Booking Created',
  'Cargo Received',
  'Container Stuffing',
  'Gate In',
  'Customs Cleared',
  'Loaded On Vessel',
  'Vessel Departed',
  'Transshipment',
  'Vessel Arrived',
  'Container Discharged',
  'Out For Delivery',
  'Delivered',
];

// Air milestone timeline (flight events — no container stuffing / gate-in / discharge).
const AIR_EVENTS = [
  'Booking Created',
  'Cargo Received',
  'Customs Cleared',
  'Handed To Airline',
  'Flight Departed',
  'Transshipment',
  'Flight Arrived',
  'Cargo Delivered To Customs',
  'Out For Delivery',
  'Delivered',
];

@Injectable()
export class TrackingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly shipmentMilestoneService: ShipmentMilestoneService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public entry points
  // ---------------------------------------------------------------------------

  async search(referenceNo: string, context: any = {}) {
    const reference = String(referenceNo || '').trim();
    if (!reference) {
      throw new BadRequestException('Reference number is required');
    }

    const trackingContext = this.normalizeTrackingContext(context);
    const searchType = this.normalizeSearchType(
      context?.searchType ?? context?.SearchType ?? context?.type,
    );
    const houseJobSid = this.toOptionalNumber(context?.houseJobSid ?? context?.HouseJobSid);

    const resolved = await this.resolveEntities(reference, searchType, houseJobSid, trackingContext);

    if (resolved.kind === 'not_found') {
      return {
        resultType: 'NOT_FOUND',
        searchType: (searchType || this.detectReferenceType(reference)).toUpperCase(),
        searchedReference: reference,
        message: 'No Shipment Found',
      };
    }

    if (resolved.kind === 'multiple') {
      return {
        resultType: 'MULTIPLE_MATCH',
        searchType: (searchType || 'hbl').toUpperCase(),
        searchedReference: reference,
        matches: resolved.matches,
      };
    }

    return this.buildTrackingPayload(reference, searchType, resolved, trackingContext);
  }

  getByBooking(bookingNo: string, context: any = {}) {
    return this.search(bookingNo, { ...context, searchType: 'booking' });
  }

  getByHbl(hblNo: string, context: any = {}) {
    return this.search(hblNo, { ...context, searchType: 'hbl' });
  }

  getByMbl(mblNo: string, context: any = {}) {
    return this.search(mblNo, { ...context, searchType: 'mbl' });
  }

  getByContainer(containerNo: string, context: any = {}) {
    return this.search(containerNo, { ...context, searchType: 'container' });
  }

  getByJob(jobNo: string, context: any = {}) {
    return this.search(jobNo, { ...context, searchType: 'job' });
  }

  // ---------------------------------------------------------------------------
  // Resolution (search-type aware, HBL duplicate aware, HouseJobSid aware)
  // ---------------------------------------------------------------------------

  private async resolveEntities(
    reference: string,
    searchType: SearchType | null,
    houseJobSid: number | undefined,
    context: TrackingContext,
  ): Promise<ResolvedEntities> {
    // Explicit selection coming back from the MULTIPLE_MATCH grid.
    if (houseJobSid) {
      const houseJob = await this.findHouseJobBySid(houseJobSid, context);
      if (!houseJob) return { kind: 'not_found' };
      return {
        kind: 'single',
        booking: houseJob.bookingHeader || null,
        houseJob,
        masterJob: houseJob.masterJob || null,
        scope: 'HOUSE',
      };
    }

    switch (searchType) {
      case 'booking':
        return this.resolveBooking(reference, context);
      case 'hbl':
        return this.resolveHbl(reference, context);
      case 'mbl':
        return this.resolveMbl(reference, context);
      case 'job':
        return this.resolveJob(reference, context);
      case 'container':
        return this.resolveContainerSearch(reference, context);
      default:
        return this.resolveAuto(reference, context);
    }
  }

  private async resolveBooking(reference: string, context: TrackingContext): Promise<ResolvedEntities> {
    const booking = await this.findBookingByNo(reference, context);
    if (!booking) return { kind: 'not_found' };
    const houseJob = this.firstHouseOf(booking);
    return {
      kind: 'single',
      booking,
      houseJob,
      masterJob: houseJob?.masterJob || null,
      scope: 'BOOKING',
    };
  }

  private async resolveHbl(reference: string, context: TrackingContext): Promise<ResolvedEntities> {
    const houseJobs = await this.findHouseJobsByHbl(reference, context);
    if (!houseJobs.length) return { kind: 'not_found' };

    // Business rule: HBLNo is NOT unique. Never auto-load when duplicates exist.
    if (houseJobs.length > 1) {
      return { kind: 'multiple', matches: houseJobs.map((item) => this.toMatchRow(item)) };
    }

    const houseJob = houseJobs[0];
    return {
      kind: 'single',
      booking: houseJob.bookingHeader || null,
      houseJob,
      masterJob: houseJob.masterJob || null,
      scope: 'HOUSE',
    };
  }

  private async resolveMbl(reference: string, context: TrackingContext): Promise<ResolvedEntities> {
    const masterJob = await this.findMasterByMbl(reference, context);
    if (masterJob) {
      return this.masterToResolution(masterJob, 'MASTER');
    }

    // Some flows keep the MBL on the house job only.
    const houseJob = await this.db.houseJob.findFirst({
      where: {
        status: 'A',
        ...this.customerContextWhere(context),
        MBLNo: { equals: reference, mode: 'insensitive' },
      },
      select: this.houseJobSelect(true),
    });
    if (!houseJob) return { kind: 'not_found' };

    const master = houseJob.masterJob
      ? await this.ensureMasterWithHouses(houseJob.masterJob, context)
      : null;
    if (master) {
      return this.masterToResolution(master, 'MASTER');
    }
    return {
      kind: 'single',
      booking: houseJob.bookingHeader || null,
      houseJob,
      masterJob: null,
      scope: 'HOUSE',
    };
  }

  private async resolveJob(reference: string, context: TrackingContext): Promise<ResolvedEntities> {
    const masterJob = await this.db.masterJob.findFirst({
      where: {
        Status: 'A',
        ...this.companyContextWhere(context),
        ...(this.hasCustomerContext(context)
          ? { houseJob: { some: { status: 'A', ...this.customerContextWhere(context) } } }
          : {}),
        MasterJobNumber: { equals: reference, mode: 'insensitive' },
      },
      select: this.masterJobSelect(true, context),
    });
    if (masterJob) {
      return this.masterToResolution(masterJob, 'MASTER');
    }

    const houseJob = await this.db.houseJob.findFirst({
      where: {
        status: 'A',
        ...this.customerContextWhere(context),
        ShipmentNo: { equals: reference, mode: 'insensitive' },
      },
      select: this.houseJobSelect(true),
    });
    if (!houseJob) return { kind: 'not_found' };

    return {
      kind: 'single',
      booking: houseJob.bookingHeader || null,
      houseJob,
      masterJob: houseJob.masterJob || null,
      scope: 'HOUSE',
    };
  }

  private async resolveContainerSearch(reference: string, context: TrackingContext): Promise<ResolvedEntities> {
    // A physical container can be reused across MULTIPLE House Jobs in DIFFERENT Master
    // Jobs. Gather EVERY House Job whose product rows reference this container — by the
    // ContainerNo string or via the linked Master Job container — so a shared container
    // opens the same "pick a House Job" match modal as a shared HBL (not just the first).
    const houseJobs = await this.db.houseJob.findMany({
      where: {
        status: 'A',
        ...this.customerContextWhere(context),
        Products: {
          some: {
            status: 'A',
            OR: [
              { ContainerNo: { equals: reference, mode: 'insensitive' } },
              { masterJobContainer: { ContainerNumber: { equals: reference, mode: 'insensitive' } } },
            ],
          },
        },
      },
      select: this.houseJobSelect(true),
    });

    if (houseJobs.length > 1) {
      return { kind: 'multiple', matches: houseJobs.map((item) => this.toMatchRow(item)) };
    }
    if (houseJobs.length === 1) {
      const houseJob = houseJobs[0];
      return {
        kind: 'single',
        booking: houseJob.bookingHeader || null,
        houseJob,
        masterJob: houseJob.masterJob || null,
        scope: 'HOUSE',
      };
    }

    // No House Job references the container — fall back to a Master Job that carries it
    // (declared on the master but not yet mapped to a house), shown at master level.
    const masterJob = await this.db.masterJob.findFirst({
      where: {
        Status: 'A',
        ...this.companyContextWhere(context),
        containers: {
          some: { Status: 'A', ContainerNumber: { equals: reference, mode: 'insensitive' } },
        },
      },
      select: this.masterJobSelect(true, context),
    });
    if (masterJob) {
      return { kind: 'single', booking: null, houseJob: null, masterJob, scope: 'CONTAINER' };
    }

    return { kind: 'not_found' };
  }

  /**
   * Container search: a container under a Master Job can be mapped to several
   * House Jobs (product rows). Force a House Job selection limited to the houses
   * actually mapped to THIS container; a single mapped house opens directly.
   */
  private containerToResolution(masterJob: any, reference: string): ResolvedEntities {
    const mappedHouses = this.housesMappedToContainer(masterJob, reference);

    if (mappedHouses.length > 1) {
      return { kind: 'multiple', matches: mappedHouses.map((item) => this.toMatchRow(item)) };
    }

    if (mappedHouses.length === 1) {
      const houseJob = mappedHouses[0];
      return {
        kind: 'single',
        booking: houseJob.bookingHeader || null,
        houseJob,
        masterJob,
        scope: 'HOUSE',
      };
    }

    // Container exists but no house product is linked to it — show master view.
    return { kind: 'single', booking: null, houseJob: null, masterJob, scope: 'CONTAINER' };
  }

  /** House Jobs whose product rows are linked to the searched container (by Sid or ContainerNo). */
  private housesMappedToContainer(masterJob: any, reference: string): any[] {
    const ref = this.normalizeReference(reference);
    const matchedContainer = (masterJob?.containers || []).find(
      (container) => this.normalizeReference(container?.ContainerNumber) === ref,
    );
    const containerSid = matchedContainer?.MasterJobContainerSid ?? null;

    return (masterJob?.houseJob || []).filter((houseJob) =>
      (houseJob?.Products || []).some(
        (product) =>
          (containerSid != null && product?.MasterJobContainerSid === containerSid) ||
          this.normalizeReference(product?.ContainerNo) === ref,
      ),
    );
  }

  /** Fallback when the caller does not declare a search type. */
  private async resolveAuto(reference: string, context: TrackingContext): Promise<ResolvedEntities> {
    const booking = await this.findBookingByNo(reference, context);
    if (booking) {
      const houseJob = this.firstHouseOf(booking);
      return {
        kind: 'single',
        booking,
        houseJob,
        masterJob: houseJob?.masterJob || null,
        scope: 'BOOKING',
      };
    }

    const houseJobs = await this.findHouseJobsByHbl(reference, context);
    if (houseJobs.length === 1) {
      const houseJob = houseJobs[0];
      return {
        kind: 'single',
        booking: houseJob.bookingHeader || null,
        houseJob,
        masterJob: houseJob.masterJob || null,
        scope: 'HOUSE',
      };
    }
    if (houseJobs.length > 1) {
      return { kind: 'multiple', matches: houseJobs.map((item) => this.toMatchRow(item)) };
    }

    const mbl = await this.resolveMbl(reference, context);
    if (mbl.kind !== 'not_found') return mbl;

    const job = await this.resolveJob(reference, context);
    if (job.kind !== 'not_found') return job;

    return this.resolveContainerSearch(reference, context);
  }

  // ---------------------------------------------------------------------------
  // Finders
  // ---------------------------------------------------------------------------

  private findBookingByNo(reference: string, context: TrackingContext): Promise<any> {
    return this.db.bookingHeader.findFirst({
      where: {
        status: 'A',
        ...this.customerContextWhere(context),
        OR: [
          { BookingNo: { equals: reference, mode: 'insensitive' } },
          { ShipmentNo: { equals: reference, mode: 'insensitive' } },
        ],
      },
      select: this.bookingSelect(),
    });
  }

  private findHouseJobsByHbl(reference: string, context: TrackingContext): Promise<any[]> {
    return this.db.houseJob.findMany({
      where: {
        status: 'A',
        ...this.customerContextWhere(context),
        HBLNo: { equals: reference, mode: 'insensitive' },
      },
      orderBy: { HouseJobSid: 'desc' },
      select: this.houseJobSelect(true),
    });
  }

  private findHouseJobBySid(houseJobSid: number, context: TrackingContext): Promise<any> {
    return this.db.houseJob.findFirst({
      where: {
        HouseJobSid: houseJobSid,
        status: 'A',
        ...this.customerContextWhere(context),
      },
      select: this.houseJobSelect(true),
    });
  }

  private findMasterByMbl(reference: string, context: TrackingContext): Promise<any> {
    return this.db.masterJob.findFirst({
      where: {
        Status: 'A',
        ...this.companyContextWhere(context),
        ...(this.hasCustomerContext(context)
          ? { houseJob: { some: { status: 'A', ...this.customerContextWhere(context) } } }
          : {}),
        MBLNo: { equals: reference, mode: 'insensitive' },
      },
      select: this.masterJobSelect(true, context),
    });
  }

  private findMasterJobBySid(masterJobSid: number, context: TrackingContext): Promise<any> {
    return this.db.masterJob.findFirst({
      where: {
        MasterJobSid: masterJobSid,
        Status: 'A',
        ...this.companyContextWhere(context),
      },
      select: this.masterJobSelect(true, context),
    });
  }

  private findBookingBySid(bookingHeaderSid: number, context: TrackingContext): Promise<any> {
    return this.db.bookingHeader.findFirst({
      where: {
        BookingHeaderSid: bookingHeaderSid,
        status: 'A',
        ...this.customerContextWhere(context),
      },
      select: this.bookingSelect(),
    });
  }

  private findHouseJobByTranshipmentBookingSid(bookingHeaderSid: number, context: TrackingContext): Promise<any> {
    return this.db.houseJob.findFirst({
      where: {
        TranshipmentBookingSid: bookingHeaderSid,
        status: 'A',
        ...this.customerContextWhere(context),
      },
      select: this.houseJobSelect(true),
    });
  }

  private async ensureMasterWithHouses(masterJob: any, context: TrackingContext): Promise<any> {
    if (!masterJob?.MasterJobSid) return masterJob;
    if (Array.isArray(masterJob.houseJob) && masterJob.houseJob.length) return masterJob;
    return (await this.findMasterJobBySid(masterJob.MasterJobSid, context)) || masterJob;
  }

  /**
   * A Master Job (searched by Job No / MBL) can hold many House Jobs. Force a
   * House Job selection so the user tracks ONE house and its milestones show
   * correctly. A single-house master loads that house directly; a house-less
   * master falls back to the master-level view.
   */
  private masterToResolution(masterJob: any, fallbackScope: TrackingScope): ResolvedEntities {
    const houseJobs = this.toArray(masterJob?.houseJob);

    if (houseJobs.length > 1) {
      return { kind: 'multiple', matches: houseJobs.map((item) => this.toMatchRow(item)) };
    }

    if (houseJobs.length === 1) {
      const houseJob = houseJobs[0];
      return {
        kind: 'single',
        booking: houseJob.bookingHeader || null,
        houseJob,
        masterJob,
        scope: 'HOUSE',
      };
    }

    return { kind: 'single', booking: null, houseJob: null, masterJob, scope: fallbackScope };
  }

  private firstHouseOf(booking: any): any {
    return this.toArray(booking?.houseJob)[0] || null;
  }

  private toMatchRow(houseJob: any) {
    const voyage = houseJob.masterJob?.voyages?.[0];
    const vesselName = houseJob.VesselName || voyage?.VesselName || null;
    const voyageNo = houseJob.VoyageNo || voyage?.VoyageNo || null;

    return {
      houseJobSid: houseJob.HouseJobSid,
      hblNo: houseJob.HBLNo || null,
      mblNo: houseJob.MBLNo || houseJob.masterJob?.MBLNo || null,
      masterJobNumber: houseJob.masterJob?.MasterJobNumber || null,
      masterJobSid: houseJob.masterJob?.MasterJobSid || houseJob.MasterJobSid || null,
      jobNo: houseJob.ShipmentNo || null,
      shipmentNo: houseJob.ShipmentNo || null,
      bookingNo: houseJob.BookingNo || houseJob.bookingHeader?.BookingNo || null,
      department: houseJob.departmentMaster?.departmentName || null,
      jobType: this.isTranshipmentType(houseJob.JobType) ? 'Transhipment' : houseJob.JobType || null,
      customerName: houseJob.CustomerName || houseJob.bookingHeader?.CustomerName || null,
      pol: houseJob.POL || houseJob.bookingHeader?.POL || null,
      pod: houseJob.POD || houseJob.bookingHeader?.POD || null,
      vesselVoyage: [vesselName, voyageNo].filter(Boolean).join(' / ') || null,
      etd: houseJob.ETD || voyage?.ETD || houseJob.bookingHeader?.ETD || null,
      eta: houseJob.ETA || voyage?.ETA || houseJob.bookingHeader?.ETA || null,
    };
  }

  // ---------------------------------------------------------------------------
  // Payload assembly
  // ---------------------------------------------------------------------------

  private async buildTrackingPayload(
    reference: string,
    searchType: SearchType | null,
    resolved: Extract<ResolvedEntities, { kind: 'single' }>,
    context: TrackingContext,
  ) {
    const scope = resolved.scope;
    const resolvedBooking = resolved.booking;
    const resolvedHouseJob = resolved.houseJob;
    let resolvedMasterJob = resolved.masterJob;

    if ((scope === 'MASTER' || scope === 'CONTAINER') && resolvedMasterJob) {
      resolvedMasterJob = await this.ensureMasterWithHouses(resolvedMasterJob, context);
    }

    const houseScoped = scope === 'HOUSE' || scope === 'BOOKING';
    const includeAllMasterContainers = scope === 'MASTER' || scope === 'CONTAINER';
    const resolvedHouseJobs = this.resolveHouseJobsScoped(
      houseScoped,
      resolvedHouseJob,
      resolvedMasterJob,
      resolvedBooking,
    );
    const containers = this.resolveContainers(
      resolvedMasterJob,
      resolvedHouseJobs,
      resolvedBooking,
      includeAllMasterContainers,
    );
    const cargoSummary = this.buildCargoSummary(resolvedHouseJobs, containers, resolvedBooking);
    const cargoDates = this.resolveCargoDates(resolvedHouseJobs, resolvedBooking);
    const shipmentNo =
      resolvedHouseJob?.ShipmentNo ||
      resolvedBooking?.ShipmentNo ||
      resolvedMasterJob?.MasterJobNumber ||
      null;
    const departmentMaster =
      resolvedHouseJob?.departmentMaster ||
      resolvedBooking?.departmentMaster ||
      (await this.findDepartmentMaster(resolvedMasterJob?.DepartmentMasterSid)) ||
      null;
    const transportMode = this.resolveTransportMode(departmentMaster);
    const milestones = await this.resolveMilestones(
      scope,
      reference,
      resolvedBooking,
      resolvedHouseJob,
      resolvedMasterJob,
      resolvedHouseJobs,
      containers,
      transportMode,
      cargoDates,
    );
    const documents = await this.resolveDocuments(
      scope,
      resolvedBooking,
      resolvedHouseJob,
      resolvedHouseJobs,
    );
    const currentStatus = this.deriveCurrentStatus(milestones);
    const detectedReferenceType = this.searchTypeToDetected(searchType, scope);
    const transhipmentChain = await this.resolveTranshipmentChain(
      resolvedBooking,
      resolvedHouseJob,
      context,
    );
    const voyageInfo = this.resolveVoyageInfo(
      resolvedBooking,
      resolvedHouseJob,
      resolvedMasterJob,
      resolvedHouseJobs,
      transhipmentChain,
    );
    const isTranshipment = this.isTranshipmentType(
      resolvedHouseJob?.JobType || resolvedBooking?.JobType,
    );
    const portNames = await this.resolvePortNames([
      resolvedHouseJob?.POO || resolvedBooking?.POO || resolvedMasterJob?.POO,
      resolvedHouseJob?.POL || resolvedBooking?.POL || resolvedMasterJob?.POL,
      resolvedHouseJob?.POD || resolvedBooking?.POD || resolvedMasterJob?.POD,
      resolvedHouseJob?.FPD || resolvedBooking?.FPD || resolvedMasterJob?.FPD,
      ...(voyageInfo.voyageLegs || []).flatMap((leg: any) => [leg?.pol, leg?.pod]),
    ]);

    return {
      resultType: 'SINGLE',
      searchType: (searchType || detectedReferenceType).toUpperCase(),
      searchedReference: reference,
      shipmentInfo: {
        shipmentNumber: shipmentNo,
        bookingNumber: resolvedHouseJob?.BookingNo || resolvedBooking?.BookingNo || null,
        jobNumber: resolvedMasterJob?.MasterJobNumber || null,
        hblHawbNumber:
          this.joinUnique(resolvedHouseJobs.map((item) => item?.HBLNo)) ||
          resolvedHouseJob?.HBLNo ||
          resolvedBooking?.HBLNo ||
          null,
        mblMawbNumber:
          resolvedMasterJob?.MBLNo ||
          this.joinUnique(resolvedHouseJobs.map((item) => item?.MBLNo)) ||
          resolvedBooking?.MBLNo ||
          null,
        shipmentStatus: currentStatus.label,
        department: departmentMaster?.departmentName || null,
        departmentType: departmentMaster?.departmentType || null,
        transportMode,
        segment: departmentMaster?.FCLLCL || null,
        exportImport: departmentMaster?.ExportImport || null,
        jobType: isTranshipment
          ? 'Transhipment'
          : resolvedHouseJob?.JobType ||
            resolvedBooking?.JobType ||
            resolvedHouseJob?.MovementType ||
            resolvedBooking?.MovementType ||
            resolvedMasterJob?.MovementType ||
            null,
        isTranshipment,
        movementType:
          resolvedHouseJob?.MovementType ||
          resolvedBooking?.MovementType ||
          resolvedMasterJob?.MovementType ||
          null,
        customerName: resolvedHouseJob?.CustomerName || resolvedBooking?.CustomerName || null,
        vesselVoyage: voyageInfo.vesselVoyage,
        vesselName: voyageInfo.vesselName,
        voyageNo: voyageInfo.voyageNo,
        etd: voyageInfo.etd,
        eta: voyageInfo.eta,
        atd: voyageInfo.atd,
        ata: voyageInfo.ata,
        voyageLegs: voyageInfo.voyageLegs,
      },
      routeInfo: {
        origin: resolvedHouseJob?.POO || resolvedBooking?.POO || resolvedMasterJob?.POO || null,
        pol: resolvedHouseJob?.POL || resolvedBooking?.POL || resolvedMasterJob?.POL || null,
        pod: resolvedHouseJob?.POD || resolvedBooking?.POD || resolvedMasterJob?.POD || null,
        finalDestination:
          resolvedHouseJob?.FPD || resolvedBooking?.FPD || resolvedMasterJob?.FPD || null,
        cargoReceivedDate: cargoDates.cargoReceivedDate,
        deliveryDate: cargoDates.deliveryDate,
        portNames,
        route: this.compact([
          resolvedHouseJob?.POO || resolvedBooking?.POO || resolvedMasterJob?.POO,
          resolvedHouseJob?.POL || resolvedBooking?.POL || resolvedMasterJob?.POL,
          resolvedHouseJob?.POD || resolvedBooking?.POD || resolvedMasterJob?.POD,
          resolvedHouseJob?.FPD || resolvedBooking?.FPD || resolvedMasterJob?.FPD,
        ]),
      },
      bookingInfo: this.mapBooking(resolvedBooking),
      jobInfo: this.mapJob(resolvedMasterJob, resolvedHouseJob),
      containers,
      cargoSummary,
      milestones,
      documents,
      currentStatus,
      summary: {
        searchedReference: reference,
        detectedReferenceType,
        matchedReferenceType: detectedReferenceType,
        totalContainers: containers.length,
        totalDocuments: documents.length,
        totalHouseJobs: resolvedHouseJobs.length,
        completedMilestones: milestones.filter((item) =>
          ['completed', 'current'].includes(item.state),
        ).length,
        nextMilestone: milestones.find((item) => item.state === 'pending') || null,
      },
    };
  }

  private resolveHouseJobsScoped(houseScoped: boolean, houseJob: any, masterJob: any, booking: any) {
    if (houseScoped) {
      return [houseJob].filter(Boolean);
    }

    const houseJobs = [
      ...this.toArray(masterJob?.houseJob),
      ...this.toArray(booking?.houseJob),
      houseJob,
    ].filter(Boolean);
    const seen = new Set<number>();

    return houseJobs.filter((item) => {
      const sid = Number(item?.HouseJobSid);
      if (!sid) return true;
      if (seen.has(sid)) return false;
      seen.add(sid);
      return true;
    });
  }

  private buildCargoSummary(houseJobs: any[], containers: any[], booking: any) {
    let totalPackages: number | null = null;
    let totalGrossWeight: number | null = null;
    let totalVolume: number | null = null;
    let totalVolumetric: number | null = null;
    let totalChargeableWeight: number | null = null;
    let totalContainers: number | null = null;
    let totalCommodities = 0;
    let hasProducts = false;

    for (const houseJob of houseJobs || []) {
      // Commodities = number of product (commodity) lines, regardless of container linkage.
      for (const product of houseJob?.Products || []) {
        hasProducts = true;
        totalCommodities += 1;
        totalPackages = this.addNullable(totalPackages, this.toNumber(product.ExternlQty));
        totalGrossWeight = this.addNullable(totalGrossWeight, this.toNumber(product.GrossWeight));
        totalVolume = this.addNullable(totalVolume, this.toNumber(product.Volume));
      }
      // Chargeable weight, volumetric & declared container count live at the
      // cargo-block level (HouseJobCargo).
      for (const cargo of houseJob?.Cargo || []) {
        totalChargeableWeight = this.addNullable(totalChargeableWeight, this.toNumber(cargo.ChargeableWeight));
        totalVolumetric = this.addNullable(totalVolumetric, this.toNumber(cargo.Volumetric));
        totalContainers = this.addNullable(totalContainers, this.toNumber(cargo.NoofContainers));
      }
    }

    // Air / no-product fallbacks so weight & packages never come back empty when data exists.
    if (!hasProducts) {
      for (const container of containers || []) {
        totalPackages = this.addNullable(totalPackages, this.toNumber(container.packageCount));
        totalGrossWeight = this.addNullable(totalGrossWeight, this.toNumber(container.weight));
        totalVolume = this.addNullable(totalVolume, this.toNumber(container.volume));
        if (this.toNumber(container.commodityCount)) {
          totalCommodities += Number(container.commodityCount);
        }
      }
    }

    if (totalPackages === null && totalGrossWeight === null && totalVolume === null) {
      for (const cargo of booking?.bookingCargo || []) {
        totalPackages = this.addNullable(totalPackages, this.toNumber(cargo.NoOfPackage));
        totalGrossWeight = this.addNullable(totalGrossWeight, this.toNumber(cargo.GrossWeight));
        totalVolume = this.addNullable(totalVolume, this.toNumber(cargo.Volume));
      }
    }

    // Chargeable weight fallback: max(gross, volumetric) when not stored at cargo level.
    if (totalChargeableWeight === null && (totalGrossWeight !== null || totalVolumetric !== null)) {
      totalChargeableWeight = Math.max(totalGrossWeight || 0, totalVolumetric || 0) || null;
    }

    return {
      totalPackages,
      totalGrossWeight,
      totalVolume,
      totalVolumetric,
      totalChargeableWeight,
      totalContainers,
      totalCommodities: totalCommodities || null,
    };
  }

  // ---------------------------------------------------------------------------
  // Milestones
  // ---------------------------------------------------------------------------

  private async resolveMilestones(
    scope: TrackingScope,
    reference: string,
    booking: any,
    houseJob: any,
    masterJob: any,
    houseJobs: any[] = [],
    containers: any[] = [],
    transportMode: string | null = null,
    cargoDates: { cargoReceivedDate: Date | null; deliveryDate: Date | null } = {
      cargoReceivedDate: null,
      deliveryDate: null,
    },
  ): Promise<TrackingMilestone[]> {
    const stored = await this.findStoredMilestones(
      scope,
      reference,
      booking,
      houseJob,
      masterJob,
      houseJobs,
      containers,
    );
    const deduped = this.dedupeStoredMilestones(stored);

    // Dynamic, department-based timeline: the job's configured milestone master list
    // (SortBy order) overlaid with the saved milestones, so the timeline reflects the
    // department's own milestones — not a hardcoded template. Transshipment source
    // (Previous) milestones lead, then the current department's milestones. Falls back
    // to the legacy static template only when the department has no configured milestones.
    const dynamic = await this.buildDynamicMilestoneTimeline(deduped, scope, booking, houseJob, masterJob);
    if (dynamic) {
      return dynamic;
    }

    const actual = deduped.length
      ? deduped.map((item, index) => ({
          eventName: item.MilestoneName,
          eventDate: item.MilestoneDate,
          eventTime: this.formatTime(item.MilestoneDate),
          location: this.resolveLocation(item.MilestoneName, booking, houseJob, masterJob),
          remarks: item.Remarks,
          state: 'completed' as TrackingState,
          source: item.source,
          sequence: index + 1,
        }))
      : this.generateMilestones(booking, houseJob, masterJob, transportMode, cargoDates);

    return this.applyTimelineState(actual, transportMode);
  }

  /**
   * Build the tracking timeline dynamically from the job's DEPARTMENT milestone master
   * definitions (SortBy order), overlaid with the shipment's saved milestones. Returns
   * null when the department has no configured milestones (caller falls back to the
   * legacy static template). Only single-shipment scopes (HOUSE / BOOKING) are handled
   * dynamically; MASTER / CONTAINER keep the template.
   *
   * State: milestones with a date are completed except the latest (highest SortBy) dated
   * one which is 'current'; milestones without a date are 'pending'. Transshipment source
   * ('PREVIOUS') milestones are shown first, then the current department's milestones.
   */
  private async buildDynamicMilestoneTimeline(
    stored: any[],
    scope: TrackingScope,
    booking: any,
    houseJob: any,
    masterJob: any,
  ): Promise<TrackingMilestone[] | null> {
    if (scope !== 'HOUSE' && scope !== 'BOOKING') {
      return null;
    }
    const entity = houseJob || booking;
    if (!entity) {
      return null;
    }
    const departmentName =
      houseJob?.departmentMaster?.departmentName ||
      booking?.departmentMaster?.departmentName ||
      null;

    const definitions = await this.getMilestoneDefinitionsForDepartment(
      departmentName,
      entity.CompanyMasterSid ?? null,
      entity.BranchMasterSid ?? null,
    );
    if (!definitions.length) {
      return null;
    }

    // Separate transshipment source (Previous) saved milestones from the current job's.
    const sourceStored = stored.filter((item) => item.source === 'PREVIOUS');
    const currentStored = stored.filter((item) => item.source !== 'PREVIOUS');

    // Index the current saved milestones by their master, so definitions can be overlaid.
    const savedByMaster = new Map<number, any>();
    for (const item of currentStored) {
      if (item.MilestoneMasterSid != null && !savedByMaster.has(item.MilestoneMasterSid)) {
        savedByMaster.set(item.MilestoneMasterSid, item);
      }
    }

    const used = new Set<number>();
    const currentEvents = [...definitions]
      .sort((a, b) => a.SortBy - b.SortBy)
      .map((def) => {
        const saved = savedByMaster.get(def.MilestoneMasterSid);
        if (saved) {
          used.add(def.MilestoneMasterSid);
        }
        return this.buildTimelineEvent(def.MilestoneName, saved, booking, houseJob, masterJob);
      });

    // Any saved current milestone not represented by a definition — keep it (don't lose data).
    const currentExtras = currentStored
      .filter((item) => item.MilestoneMasterSid == null || !used.has(item.MilestoneMasterSid))
      .map((item) => this.buildTimelineEvent(item.MilestoneName, item, booking, houseJob, masterJob));

    // Transshipment source milestones lead the timeline (all already captured).
    const sourceEvents = sourceStored.map((item) =>
      this.buildTimelineEvent(item.MilestoneName, item, booking, houseJob, masterJob),
    );

    return this.applyDynamicTimelineState([...sourceEvents, ...currentEvents, ...currentExtras]);
  }

  /** Fetch a department's configured milestones (active), with numeric SortBy. */
  private async getMilestoneDefinitionsForDepartment(
    departmentName: string | null,
    companyMasterSid: number | null,
    branchMasterSid: number | null,
  ): Promise<{ MilestoneMasterSid: number; MilestoneName: string; SortBy: number }[]> {
    if (!departmentName) {
      return [];
    }
    const where: any = {
      status: 'A',
      DepartmentMasterSid: { has: departmentName },
    };
    if (companyMasterSid != null) {
      where.CompanyMasterSid = companyMasterSid;
    }
    if (branchMasterSid != null) {
      where.BranchMasterSid = branchMasterSid;
    }
    const masters = await this.db.milestoneMaster.findMany({
      where,
      select: { MilestoneMasterSid: true, MilestoneName: true, SortBy: true },
    });
    return masters.map((master) => ({
      MilestoneMasterSid: master.MilestoneMasterSid,
      MilestoneName: master.MilestoneName,
      SortBy: Number(master.SortBy),
    }));
  }

  private buildTimelineEvent(
    eventName: string,
    saved: any,
    booking: any,
    houseJob: any,
    masterJob: any,
  ): TrackingMilestone {
    return {
      eventName,
      eventDate: saved?.MilestoneDate ?? null,
      eventTime: saved?.MilestoneDate ? this.formatTime(saved.MilestoneDate) : null,
      location: this.resolveLocation(eventName, booking, houseJob, masterJob),
      remarks: saved?.Remarks ?? null,
      state: 'pending' as TrackingState,
      source: saved?.source ?? 'system',
      sequence: 0,
    };
  }

  /** Completed for dated milestones (latest dated = current), pending for undated — keeping SortBy order. */
  private applyDynamicTimelineState(timeline: TrackingMilestone[]): TrackingMilestone[] {
    let lastDatedIndex = -1;
    timeline.forEach((event, index) => {
      if (event.eventDate) {
        lastDatedIndex = index;
      }
    });
    return timeline.map((event, index) => ({
      ...event,
      sequence: index + 1,
      state: !event.eventDate
        ? ('pending' as TrackingState)
        : index < lastDatedIndex
          ? ('completed' as TrackingState)
          : ('current' as TrackingState),
    }));
  }

  /** Milestone template differs by mode: Air uses flight events, Sea uses vessel/container events. */
  private milestoneEvents(transportMode: string | null): string[] {
    return String(transportMode || '').toUpperCase() === 'AIR' ? AIR_EVENTS : SEA_EVENTS;
  }

  private async findStoredMilestones(
    scope: TrackingScope,
    reference: string,
    booking: any,
    houseJob: any,
    masterJob: any,
    houseJobs: any[] = [],
    containers: any[] = [],
  ) {
    if (scope === 'BOOKING' && booking?.BookingNo) {
      return this.findBookingScreenMilestones(booking);
    }

    if (scope === 'CONTAINER') {
      return this.findContainerScreenMilestones(reference, houseJobs, containers);
    }

    if (scope === 'MASTER') {
      return this.findMasterScreenMilestones(houseJobs);
    }

    // HOUSE
    if (houseJob?.ShipmentNo || houseJob?.HBLNo) {
      return this.findHouseJobScreenMilestones(houseJob, booking);
    }

    if (booking?.BookingNo) {
      return this.findBookingScreenMilestones(booking);
    }

    return [];
  }

  private async findMasterScreenMilestones(houseJobs: any[]) {
    const groups = await Promise.all(
      houseJobs.map((houseJob) => this.findHouseJobScreenMilestones(houseJob, houseJob?.bookingHeader)),
    );
    return groups.flat().sort(this.sortMilestones);
  }

  private async findContainerScreenMilestones(reference: string, houseJobs: any[], containers: any[]) {
    const normalizedReference = this.normalizeReference(reference);
    const matchedContainer = containers.find(
      (container) => this.normalizeReference(container?.containerNo) === normalizedReference,
    );
    const relevantHouseJobSids = new Set((matchedContainer?.houseJobSids || []).map(Number));
    const relevantHouseJobs = relevantHouseJobSids.size
      ? houseJobs.filter((item) => relevantHouseJobSids.has(Number(item?.HouseJobSid)))
      : houseJobs;

    return this.findMasterScreenMilestones(relevantHouseJobs);
  }

  private async findBookingScreenMilestones(booking: any) {
    if (!booking?.BookingHeaderSid || !booking?.CompanyMasterSid || !booking?.BranchMasterSid) {
      return [];
    }
    return this.findMilestonesByExactIdentity(
      {
        BookingHeaderSid: booking.BookingHeaderSid,
        CompanyMasterSid: booking.CompanyMasterSid,
        BranchMasterSid: booking.BranchMasterSid,
      },
      'BOOKING',
    );
  }

  private async findHouseJobScreenMilestones(houseJob: any, booking: any) {
    if (!houseJob?.HouseJobSid || !houseJob?.CompanyMasterSid ||
        !houseJob?.BranchMasterSid || !houseJob?.DepartmentMasterSid) {
      return [];
    }

    const flow = await this.shipmentMilestoneService.getJobFlow({
      companyMasterSid: Number(houseJob.CompanyMasterSid),
      branchMasterSid: Number(houseJob.BranchMasterSid),
      bookingHeaderSid: houseJob.BookingHeaderSid ?? null,
      houseJobSid: Number(houseJob.HouseJobSid),
      departmentMasterSid: Number(houseJob.DepartmentMasterSid),
    });
    const previous = (flow.previousMilestones.items || []).map(item => ({
      ...item,
      source: 'PREVIOUS',
    }));
    const current = (flow.currentMilestones.items || []).map(item => ({
      ...item,
      source: houseJob.JobType === 'Import' ? 'IMPORT' : 'HOUSE',
    }));
    return [...previous, ...current].sort(this.sortMilestones);
  }

  private async findMilestonesByExactIdentity(
    identity: {
      CompanyMasterSid: number;
      BranchMasterSid: number;
      HouseJobSid?: number;
      BookingHeaderSid?: number;
    },
    source: 'BOOKING' | 'HOUSE' | 'EXPORT' | 'IMPORT',
  ) {
    const rows = await this.db.shipmentMilestone.findMany({
      where: {
        Status: 'A',
        deletedAt: null,
        CompanyMasterSid: identity.CompanyMasterSid,
        BranchMasterSid: identity.BranchMasterSid,
        ...(identity.HouseJobSid != null
          ? { HouseJobSid: identity.HouseJobSid }
          : { BookingHeaderSid: identity.BookingHeaderSid }),
      },
      select: {
        ShipmentMilestoneSid: true,
        MilestoneMasterSid: true,
        MilestoneName: true,
        MilestoneDate: true,
        Remarks: true,
        CreatedOn: true,
        CompanyMasterSid: true,
        BranchMasterSid: true,
        HouseJobSid: true,
        BookingHeaderSid: true,
      },
    });

    // Order by the configured milestone master SortBy (numeric), MilestoneDate as tie-break,
    // so the timeline follows the department's workflow order — consistent with the job-flow.
    const masterSids = [...new Set(rows.map((row) => row.MilestoneMasterSid).filter((value) => value != null))];
    const masters = masterSids.length
      ? await this.db.milestoneMaster.findMany({
          where: { MilestoneMasterSid: { in: masterSids } },
          select: { MilestoneMasterSid: true, SortBy: true },
        })
      : [];
    const sortMap = new Map(masters.map((m) => [m.MilestoneMasterSid, Number(m.SortBy)]));

    return rows
      .sort((a, b) => {
        const sa = sortMap.get(a.MilestoneMasterSid) ?? Number.MAX_SAFE_INTEGER;
        const sb = sortMap.get(b.MilestoneMasterSid) ?? Number.MAX_SAFE_INTEGER;
        if (sa !== sb) {
          return sa - sb;
        }
        const da = a.MilestoneDate ? new Date(a.MilestoneDate).getTime() : 0;
        const db = b.MilestoneDate ? new Date(b.MilestoneDate).getTime() : 0;
        return da - db;
      })
      .map((item) => ({ ...item, source }));
  }

  private async findTransferSourceHouse(
    destinationHouseJobSid: number,
  ): Promise<{
    HouseJobSid: number;
    CompanyMasterSid: number;
    BranchMasterSid: number;
  } | null> {
    const transferMap = await this.db.auditLog.findFirst({
      where: {
        tableName: 'HouseJobTransfer',
        recordId: String(destinationHouseJobSid),
        operation: 'EXPORT_TO_IMPORT',
      },
      orderBy: { changedAt: 'desc' },
      select: { changes: true },
    });
    const changes = transferMap?.changes as Record<string, unknown> | null;
    const sourceHouseJobSid = Number(changes?.sourceHouseJobSid);
    if (!Number.isInteger(sourceHouseJobSid) || sourceHouseJobSid <= 0) {
      return null;
    }

    const sourceHouse = await this.db.houseJob.findFirst({
      where: {
        HouseJobSid: sourceHouseJobSid,
        status: 'A',
        deletedAt: null,
      },
      select: {
        HouseJobSid: true,
        CompanyMasterSid: true,
        BranchMasterSid: true,
      },
    });
    if (!sourceHouse || sourceHouse.BranchMasterSid == null) {
      return null;
    }
    return {
      HouseJobSid: sourceHouse.HouseJobSid,
      CompanyMasterSid: sourceHouse.CompanyMasterSid,
      BranchMasterSid: sourceHouse.BranchMasterSid,
    };
  }

  private dedupeStoredMilestones(items: any[]): any[] {
    const seen = new Set<string>();
    return (items || []).filter((item) => {
      const key = item?.ShipmentMilestoneSid != null
        ? `SID:${item.ShipmentMilestoneSid}`
        : [
            item?.CompanyMasterSid,
            item?.BranchMasterSid,
            item?.HouseJobSid,
            this.normalize(item?.MilestoneName),
            new Date(item?.MilestoneDate || 0).getTime(),
          ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private sortMilestones(a: any, b: any) {
    const dateA = new Date(a.MilestoneDate || a.CreatedOn || 0).getTime();
    const dateB = new Date(b.MilestoneDate || b.CreatedOn || 0).getTime();
    return dateA - dateB;
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  private async resolveDocuments(
    scope: TrackingScope,
    booking: any,
    houseJob: any,
    houseJobs: any[] = [],
  ): Promise<TrackingDocument[]> {
    if (scope === 'BOOKING' && booking?.BookingHeaderSid) {
      return this.findBookingScreenDocuments(booking);
    }

    if (scope === 'MASTER' || scope === 'CONTAINER') {
      return this.findMasterScreenDocuments(houseJobs, booking);
    }

    if (houseJob?.HouseJobSid) {
      return this.findHouseJobScreenDocuments(houseJob, booking);
    }

    if (booking?.BookingHeaderSid) {
      return this.findBookingScreenDocuments(booking);
    }

    return [];
  }

  private async findMasterScreenDocuments(houseJobs: any[], booking: any): Promise<TrackingDocument[]> {
    const houseSids = houseJobs.map((item) => item?.HouseJobSid).filter(Boolean);
    const bookingSids = [
      ...houseJobs.map((item) => item?.BookingHeaderSid),
      booking?.BookingHeaderSid,
    ].filter(Boolean);

    const houseDocuments = await this.findDocumentsByMenuAndDocumentSid('House Job', houseSids, 'HOUSE');
    const bookingDocuments = await this.findDocumentsByMenuAndDocumentSid('Booking', bookingSids, 'BOOKING');

    return [...houseDocuments, ...bookingDocuments].sort(this.sortDocuments);
  }

  private async findBookingScreenDocuments(booking: any): Promise<TrackingDocument[]> {
    const houseJobs = booking?.BookingHeaderSid
      ? await this.db.houseJob.findMany({
          where: { status: 'A', BookingHeaderSid: booking.BookingHeaderSid },
          select: { HouseJobSid: true },
        })
      : [];

    const bookingDocuments = await this.findDocumentsByMenuAndDocumentSid(
      'Booking',
      [booking?.BookingHeaderSid],
      'BOOKING',
    );
    const houseDocuments = await this.findDocumentsByMenuAndDocumentSid(
      'House Job',
      houseJobs.map((item) => item.HouseJobSid),
      'HOUSE',
    );

    return [...bookingDocuments, ...houseDocuments].sort(this.sortDocuments);
  }

  private async findHouseJobScreenDocuments(houseJob: any, booking: any): Promise<TrackingDocument[]> {
    const bookingHeaderSid = houseJob?.BookingHeaderSid || booking?.BookingHeaderSid;
    const houseDocuments = await this.findDocumentsByMenuAndDocumentSid(
      'House Job',
      [houseJob?.HouseJobSid],
      'HOUSE',
    );
    const bookingDocuments = bookingHeaderSid
      ? await this.findDocumentsByMenuAndDocumentSid('Booking', [bookingHeaderSid], 'BOOKING')
      : [];

    return [...houseDocuments, ...bookingDocuments].sort(this.sortDocuments);
  }

  private async findDocumentsByMenuAndDocumentSid(
    menuName: string,
    documentSids: Array<number | null | undefined>,
    source: 'BOOKING' | 'HOUSE',
  ): Promise<TrackingDocument[]> {
    const ids = [...new Set(documentSids.filter((item): item is number => Number.isFinite(Number(item))).map(Number))];
    if (!ids.length) return [];

    const groups = await this.db.attachDocumentGroup.findMany({
      where: {
        status: 'A',
        MenuName: { equals: menuName, mode: 'insensitive' },
        DocumentSid: { in: ids },
      },
      orderBy: { createdOn: 'desc' },
      select: {
        AttachDocumentGroupSid: true,
        MenuName: true,
        DocumentSid: true,
        createdOn: true,
        attachFiles: {
          // Tracking is customer-facing: only documents ticked as Public are exposed.
          where: { status: 'A', Public: 'Y' },
          orderBy: { createdOn: 'desc' },
          select: {
            AttachDocumentSid: true,
            AttachDocmentNo: true,
            DocumentDate: true,
            FileName: true,
            ReceivedDate: true,
            Public: true,
            createdOn: true,
            SentDate: true,
            DocumentType: true,
            FilePath: true,
          },
        },
      },
    });

    return groups.flatMap((group) =>
      group.attachFiles.map((file) => ({
        documentName: file.FileName,
        attachDocumentSid: file.AttachDocumentSid,
        documentType: file.DocumentType || null,
        documentNo: file.AttachDocmentNo || null,
        documentDate: file.DocumentDate || null,
        receivedDate: file.ReceivedDate || null,
        sentDate: file.SentDate || null,
        source,
        menuName: group.MenuName || null,
        fileName: file.FileName,
        filePath: file.FilePath,
        downloadUrl: `tracking/document/${file.AttachDocumentSid}`,
        isPublic: file.Public === 'Y',
        uploadedOn: file.createdOn || group.createdOn || null,
      })),
    );
  }

  async getDocumentFile(attachDocumentSid: number) {
    if (!Number.isFinite(attachDocumentSid)) {
      throw new BadRequestException('Invalid document id');
    }

    const document = await this.db.attachDocument.findFirst({
      // Only Public documents are downloadable through the customer-facing tracking portal.
      where: { AttachDocumentSid: attachDocumentSid, status: 'A', Public: 'Y' },
      select: {
        FileName: true,
        FilePath: true,
        attachGroup: {
          select: {
            MenuName: true,
            DocumentSid: true,
          },
        },
      },
    });

    if (!document?.FilePath) {
      throw new NotFoundException('Document file not found');
    }

    const absolutePath = this.resolveDocumentFilePath(
      document.FilePath,
      document.FileName,
      document.attachGroup?.MenuName,
      document.attachGroup?.DocumentSid,
    );
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      throw new NotFoundException('Document file not found on server');
    }

    return {
      fileName: document.FileName,
      absolutePath,
    };
  }

  private resolveDocumentFilePath(
    filePath: string,
    fileName: string,
    menuName?: string | null,
    documentSid?: number | null,
  ) {
    const normalizedPath = String(filePath || '').replace(/\\/g, '/');
    const workspaceRoot = path.resolve(process.cwd(), '..');
    const relativeAssetPath = normalizedPath.replace(/^\.\.\//, '');
    const assetRoot = path.resolve(workspaceRoot, 'freight-forwarding-assets');
    const candidates = [
      path.resolve(process.cwd(), normalizedPath),
      path.resolve(workspaceRoot, relativeAssetPath),
      ...(menuName && documentSid
        ? [path.resolve(assetRoot, 'Edoc', menuName, String(documentSid), fileName)]
        : []),
    ];

    const exactMatch = candidates.find((candidate) => fs.existsSync(candidate));
    if (exactMatch) return exactMatch;

    return this.findFileByName(path.resolve(assetRoot, 'Edoc', menuName || ''), fileName) || candidates[0];
  }

  private findFileByName(root: string, fileName: string): string | null {
    if (!root || !fs.existsSync(root)) return null;

    const pending = [root];
    while (pending.length) {
      const current = pending.pop();
      if (!current) continue;

      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          pending.push(fullPath);
        } else if (entry.isFile() && entry.name === fileName) {
          return fullPath;
        }
      }
    }

    return null;
  }

  private sortDocuments(a: TrackingDocument, b: TrackingDocument) {
    const dateA = new Date(a.uploadedOn || a.documentDate || 0).getTime();
    const dateB = new Date(b.uploadedOn || b.documentDate || 0).getTime();
    return dateB - dateA;
  }

  // ---------------------------------------------------------------------------
  // Timeline generation / state
  // ---------------------------------------------------------------------------

  private generateMilestones(
    booking: any,
    houseJob: any,
    masterJob: any,
    transportMode: string | null = null,
    cargoDates: { cargoReceivedDate: Date | null; deliveryDate: Date | null } = {
      cargoReceivedDate: null,
      deliveryDate: null,
    },
  ): TrackingMilestone[] {
    const firstProduct =
      houseJob?.Products?.find((item) => item.CargoRecDate) ||
      booking?.bookingProduct?.find((item) => item.CargoRecDate);
    const voyage = masterJob?.voyages?.[0];
    const stuffingDate = masterJob?.others?.[0]?.StuffingStartDate;
    const pol = masterJob?.POL || houseJob?.POL || booking?.POL;
    const pod = masterJob?.POD || houseJob?.POD || booking?.POD;
    const fpd = houseJob?.FPD || booking?.FPD || masterJob?.FPD;
    const cargoReceivedDate = cargoDates.cargoReceivedDate || firstProduct?.CargoRecDate || null;
    const deliveredDate = cargoDates.deliveryDate || null;

    if (String(transportMode || '').toUpperCase() === 'AIR') {
      return [
        this.event('Booking Created', booking?.createdOn || houseJob?.createdOn || masterJob?.CreatedOn, pol, 'booking'),
        this.event('Cargo Received', cargoReceivedDate, firstProduct?.CFS || pol, 'house_job'),
        this.event('Customs Cleared', null, pol, 'system'),
        this.event('Handed To Airline', masterJob?.PortCutoffDate || booking?.PortCutoffDate, pol, 'system'),
        this.event('Flight Departed', voyage?.ATD || voyage?.ETD || houseJob?.ETD || booking?.ETD, pol, 'voyage'),
        this.event('Transshipment', null, null, 'voyage'),
        this.event('Flight Arrived', voyage?.ATA || voyage?.ETA || houseJob?.ETA || booking?.ETA, pod, 'voyage'),
        this.event('Cargo Delivered To Customs', null, pod, 'system'),
        this.event('Out For Delivery', null, fpd, 'system'),
        this.event('Delivered', deliveredDate, fpd, 'house_job'),
      ].map((item, index) => ({ ...item, sequence: index + 1 }));
    }

    return [
      this.event('Booking Created', booking?.createdOn || houseJob?.createdOn || masterJob?.CreatedOn, pol, 'booking'),
      this.event('Cargo Received', cargoReceivedDate, firstProduct?.CFS || pol, 'house_job'),
      this.event('Container Stuffing', stuffingDate, pol, 'container'),
      this.event('Gate In', masterJob?.PortCutoffDate || booking?.PortCutoffDate, pol, 'container'),
      this.event('Customs Cleared', null, pol, 'system'),
      this.event('Loaded On Vessel', voyage?.ETD || houseJob?.ETD || booking?.ETD, pol, 'voyage'),
      this.event('Vessel Departed', voyage?.ATD || voyage?.ETD || houseJob?.ETD || booking?.ETD, pol, 'voyage'),
      this.event('Transshipment', null, null, 'voyage'),
      this.event('Vessel Arrived', voyage?.ATA || voyage?.ETA || houseJob?.ETA || booking?.ETA, pod, 'voyage'),
      this.event('Container Discharged', voyage?.DestinationATA || voyage?.ATA, pod, 'container'),
      this.event('Out For Delivery', null, fpd, 'system'),
      this.event('Delivered', deliveredDate, fpd, 'house_job'),
    ].map((item, index) => ({ ...item, sequence: index + 1 }));
  }

  private event(eventName: string, date: Date | null | undefined, location: string | null | undefined, source: string): TrackingMilestone {
    return {
      eventName,
      eventDate: date || null,
      eventTime: this.formatTime(date),
      location: location || null,
      remarks: null,
      state: date ? 'completed' : 'pending',
      source,
      sequence: 0,
    };
  }

  private applyTimelineState(events: TrackingMilestone[], transportMode: string | null = null): TrackingMilestone[] {
    const template = this.milestoneEvents(transportMode);
    const canonicalNames = new Map(
      template.map((name) => [this.normalize(name), name]),
    );
    const normalizedActual = events.map((item) => ({
      ...item,
      eventName: canonicalNames.get(this.normalize(item.eventName)) || item.eventName,
    }));
    const presentNames = new Set(
      normalizedActual.map((item) => this.normalize(item.eventName)),
    );
    const missingTemplateEvents = template
      .filter((name) => !presentNames.has(this.normalize(name)))
      .map((name) => this.event(name, null, null, 'system'));
    const datedEvents = normalizedActual
      .filter((item) => item.eventDate)
      .sort(
        (left, right) =>
          new Date(left.eventDate || 0).getTime() - new Date(right.eventDate || 0).getTime(),
      );
    const pendingEvents = [
      ...normalizedActual.filter((item) => !item.eventDate),
      ...missingTemplateEvents,
    ];
    const timeline = [...datedEvents, ...pendingEvents];
    const latestCompleted = datedEvents.length - 1;

    return timeline.map((item, index) => ({
      ...item,
      sequence: index + 1,
      state:
        index < latestCompleted
          ? 'completed'
          : index === latestCompleted
            ? 'current'
            : 'pending',
    }));
  }

  private deriveCurrentStatus(milestones: TrackingMilestone[]) {
    const completed = milestones.filter((item) => ['completed', 'current'].includes(item.state));
    const names = completed.map((item) => item.eventName.toLowerCase());
    let label = 'Booking Confirmed';
    if (names.some((name) => name.includes('delivered'))) label = 'Delivered';
    else if (names.some((name) => name.includes('out for delivery'))) label = 'Out For Delivery';
    else if (names.some((name) => name.includes('arrived'))) label = 'Arrived';
    else if (names.some((name) => name.includes('departed') || name.includes('loaded'))) label = 'In Transit';

    const current = completed[completed.length - 1] || null;
    return {
      label,
      eventName: current?.eventName || null,
      eventDate: current?.eventDate || null,
    };
  }

  // ---------------------------------------------------------------------------
  // Containers (linked by MasterJobContainerSid; aggregated across all rows)
  // ---------------------------------------------------------------------------

  private resolveContainers(
    masterJob: any,
    houseJobs: any[],
    booking: any,
    includeAllMasterContainers: boolean,
  ) {
    const rows: any[] = [];
    const bySid = new Map<string, any>();
    const byNo = new Map<string, any>();

    // A physical container can be referenced either by MasterJobContainerSid or
    // by ContainerNo. Index every row under BOTH so that two commodities with
    // mixed linkage still merge into ONE container (no split weight/volume).
    const register = (row: any) => {
      if (row.masterJobContainerSid != null) bySid.set(String(row.masterJobContainerSid), row);
      const noKey = String(row.containerNo || '').toUpperCase();
      if (noKey && noKey !== 'PENDING CONTAINER ASSIGNMENT') byNo.set(noKey, row);
    };
    const findRow = (sid: any, containerNo: any) => {
      if (sid != null && bySid.has(String(sid))) return bySid.get(String(sid));
      const noKey = String(containerNo || '').toUpperCase();
      if (noKey && byNo.has(noKey)) return byNo.get(noKey);
      return null;
    };

    if (includeAllMasterContainers) {
      for (const container of masterJob?.containers || []) {
        const row = this.newContainerRow({
          masterJobContainerSid: container.MasterJobContainerSid ?? null,
          containerNo: container.ContainerNumber || null,
          containerType: container.containerType?.ContainerName || container.containerType?.ContainerCode || null,
          sealNo: container.LineSeal || container.CustomsSeal || null,
          basePackageCount: this.toNumber(container.NoOfPkg),
          baseWeight: this.toNumber(container.GrossWeight),
          baseVolume: this.toNumber(container.Volume),
        });
        rows.push(row);
        register(row);
      }
    }

    for (const houseJob of houseJobs || []) {
      for (const product of houseJob?.Products || []) {
        const sid = product.MasterJobContainerSid;
        const containerNo = product.ContainerNo || product.masterJobContainer?.ContainerNumber || null;
        // Loose / unassigned cargo is summed in cargoSummary, not as a container.
        if (sid == null && !containerNo) continue;

        let row = findRow(sid, containerNo);
        if (!row) {
          row = this.newContainerRow({
            masterJobContainerSid: sid ?? null,
            containerNo,
            containerType:
              product.masterJobContainer?.containerType?.ContainerName ||
              product.masterJobContainer?.containerType?.ContainerCode ||
              null,
            sealNo: product.masterJobContainer?.LineSeal || product.masterJobContainer?.CustomsSeal || null,
            basePackageCount: null,
            baseWeight: null,
            baseVolume: null,
          });
          rows.push(row);
        }

        if (sid != null && row.masterJobContainerSid == null) row.masterJobContainerSid = sid;
        row.containerNo = row.containerNo || containerNo;
        row.containerType =
          row.containerType ||
          product.masterJobContainer?.containerType?.ContainerName ||
          product.masterJobContainer?.containerType?.ContainerCode ||
          null;
        row.sealNo =
          row.sealNo || product.masterJobContainer?.LineSeal || product.masterJobContainer?.CustomsSeal || null;
        register(row); // refresh aliases now that sid/containerNo may be filled

        // Aggregate across ALL commodity rows (matches master-job / house-job services):
        // packages = Σ ExternlQty, weight = Σ GrossWeight, volume = Σ Volume.
        row.productPackageCount = this.addNullable(row.productPackageCount, this.toNumber(product.ExternlQty));
        row.productWeight = this.addNullable(row.productWeight, this.toNumber(product.GrossWeight));
        row.productVolume = this.addNullable(row.productVolume, this.toNumber(product.Volume));
        row.commodityCount += 1;
        if (houseJob?.HBLNo) row.hblNos.push(houseJob.HBLNo);
        if (houseJob?.HouseJobSid) row.houseJobSids.push(houseJob.HouseJobSid);
        if (houseJob?.ShipmentNo) row.shipmentNos.push(houseJob.ShipmentNo);
      }
    }

    if (!rows.length) {
      for (const cargo of booking?.bookingCargo || []) {
        const row = this.newContainerRow({
          masterJobContainerSid: null,
          containerNo: 'Pending container assignment',
          containerType: cargo.containerType?.ContainerName || cargo.containerType?.ContainerCode || null,
          sealNo: null,
          basePackageCount: this.toNumber(cargo.NoOfPackage),
          baseWeight: this.toNumber(cargo.GrossWeight),
          baseVolume: this.toNumber(cargo.Volume),
        });
        row.commodityCount = 1;
        rows.push(row);
      }
    }

    return rows.map((container) => {
      const hblNos = this.uniqueValues(container.hblNos);

      return {
        masterJobContainerSid: container.masterJobContainerSid,
        containerNo: container.containerNo || 'Pending container assignment',
        containerType: container.containerType,
        sealNo: container.sealNo,
        hblNos,
        hblNo: this.joinUnique(hblNos),
        houseJobSids: this.uniqueValues(container.houseJobSids),
        shipmentNos: this.uniqueValues(container.shipmentNos),
        commodityCount: container.commodityCount,
        packageCount: container.productPackageCount ?? container.basePackageCount,
        weight: container.productWeight ?? container.baseWeight,
        volume: container.productVolume ?? container.baseVolume,
      };
    });
  }

  private newContainerRow(seed: any) {
    return {
      masterJobContainerSid: seed.masterJobContainerSid ?? null,
      containerNo: seed.containerNo ?? null,
      containerType: seed.containerType ?? null,
      sealNo: seed.sealNo ?? null,
      basePackageCount: seed.basePackageCount ?? null,
      baseWeight: seed.baseWeight ?? null,
      baseVolume: seed.baseVolume ?? null,
      hblNos: [] as any[],
      houseJobSids: [] as any[],
      shipmentNos: [] as any[],
      commodityCount: 0,
      productPackageCount: null as number | null,
      productWeight: null as number | null,
      productVolume: null as number | null,
    };
  }

  private resolveLocation(eventName: string, booking: any, houseJob: any, masterJob: any) {
    const name = eventName.toLowerCase();
    if (name.includes('arriv') || name.includes('discharg')) return booking?.POD || houseJob?.POD || masterJob?.POD || null;
    if (name.includes('deliver')) return booking?.FPD || houseJob?.FPD || masterJob?.FPD || null;
    if (name.includes('depart') || name.includes('loaded') || name.includes('gate') || name.includes('custom')) return booking?.POL || houseJob?.POL || masterJob?.POL || null;
    return booking?.POO || houseJob?.POO || masterJob?.POO || null;
  }

  private toArray<T = any>(value: T | T[] | null | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  // ---------------------------------------------------------------------------
  // Transhipment / voyage
  // ---------------------------------------------------------------------------

  private async resolveTranshipmentChain(booking: any, houseJob: any, context: TrackingContext) {
    const isTranshipment = this.isTranshipmentType(houseJob?.JobType || booking?.JobType);
    if (!isTranshipment) {
      return null;
    }

    const sourceHouseJob = houseJob?.TranshipmentBookingSid
      ? houseJob
      : booking?.BookingHeaderSid
        ? await this.findHouseJobByTranshipmentBookingSid(booking.BookingHeaderSid, context)
        : null;
    const linkedBooking = sourceHouseJob?.TranshipmentBookingSid
      ? await this.findBookingBySid(sourceHouseJob.TranshipmentBookingSid, context)
      : null;
    const linkedHouseJob = linkedBooking?.houseJob || null;

    if (!sourceHouseJob || !linkedBooking) {
      return null;
    }

    return {
      sourceHouseJob,
      sourceBooking: sourceHouseJob.bookingHeader || null,
      linkedBooking,
      linkedHouseJob,
    };
  }

  /** Resolve port codes (POO/POL/POD/FPOD + legs) to their names via PortMaster. */
  private async resolvePortNames(codes: Array<string | null | undefined>): Promise<Record<string, string>> {
    const unique = [...new Set(codes.map((code) => String(code || '').trim()).filter(Boolean))];
    if (!unique.length) return {};

    const ports = await this.db.portMaster.findMany({
      where: { status: 'A', PortCode: { in: unique } },
      select: { PortCode: true, PortName: true },
    });

    const map: Record<string, string> = {};
    for (const port of ports) {
      if (port.PortCode && port.PortName && !map[port.PortCode]) {
        map[port.PortCode] = port.PortName;
      }
    }
    return map;
  }

  /**
   * Cargo handling dates: Cargo Received (POO) and Delivered (FPOD).
   * Both use the LATEST date across commodities — i.e. cargo is "received" only
   * once the last commodity is in, and "delivered" once the last is out.
   */
  private resolveCargoDates(houseJobs: any[], booking: any) {
    let received: Date | null = null;
    let delivered: Date | null = null;

    const considerReceived = (value: any) => {
      if (!value) return;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return;
      if (!received || date > received) received = date;
    };
    const considerDelivered = (value: any) => {
      if (!value) return;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return;
      if (!delivered || date > delivered) delivered = date;
    };

    for (const houseJob of houseJobs || []) {
      for (const product of houseJob?.Products || []) {
        considerReceived(product.CargoRecDate);
        considerDelivered(product.DeliveryDate);
      }
    }
    if (!received) {
      for (const product of booking?.bookingProduct || []) {
        considerReceived(product.CargoRecDate);
      }
    }

    return { cargoReceivedDate: received, deliveryDate: delivered };
  }

  /**
   * Authoritative per-leg routing from the connection tables. House connections
   * are used for a single (HBL/house) view; master connections for the master
   * view. These carry POL/POD/Vessel/Voyage/ETD/ETA (+ ATD/ATA at master level).
   */
  private resolveConnectionLegs(houseJobs: any[], houseJob: any, masterJob: any) {
    const isActive = (item: any) => String(item?.status ?? item?.Status ?? 'A').toUpperCase() !== 'I';
    const single = houseJobs?.length === 1 ? houseJobs[0] : houseJob;
    const houseConnections = (single?.Connections || []).filter(isActive);
    const masterConnections = (masterJob?.masterJobConnection || []).filter(isActive);
    const source = houseConnections.length ? houseConnections : masterConnections;
    if (!source.length) return [];

    const legs = source.filter(
      (connection: any) =>
        connection.VesselName || connection.VoyageNo || connection.ETD || connection.ETA || connection.POL || connection.POD,
    );
    const hblNos = this.uniqueValues((houseJobs?.length ? houseJobs : [single]).filter(Boolean).map((item) => item?.HBLNo));
    const shipmentNos = this.uniqueValues(
      (houseJobs?.length ? houseJobs : [single]).filter(Boolean).map((item) => item?.ShipmentNo),
    );

    return legs.map((connection: any, index: number) => ({
      sequence: index + 1,
      legType: legs.length > 1 ? (index === 0 ? 'First Leg' : index === legs.length - 1 ? 'Final Leg' : `Leg ${index + 1}`) : 'Voyage',
      pol: connection.POL || null,
      pod: connection.POD || null,
      hblNos,
      shipmentNos,
      vesselVoyage: this.formatVesselVoyage(connection.VesselName, connection.VoyageNo),
      vesselName: connection.VesselName || null,
      voyageNo: connection.VoyageNo || null,
      etd: connection.ETD || null,
      eta: connection.ETA || null,
      atd: connection.ATD || null,
      ata: connection.ATA || null,
    }));
  }

  private voyageInfoFromLegs(legs: any[]) {
    const primary = legs[0];
    const last = legs[legs.length - 1];
    return {
      vesselVoyage: this.formatVesselVoyage(primary.vesselName, primary.voyageNo),
      vesselName: primary.vesselName || null,
      voyageNo: primary.voyageNo || null,
      etd: primary.etd || null,
      eta: last.eta || primary.eta || null,
      atd: primary.atd || null,
      ata: last.ata || primary.ata || null,
      voyageLegs: legs,
    };
  }

  private resolveVoyageInfo(booking: any, houseJob: any, masterJob: any, houseJobs: any[], transhipmentChain?: any) {
    // Connection table drives routing ONLY for transhipment (multi-leg). For a
    // single-leg shipment the real vessel lives on the Master voyage / House job,
    // so a single connection row must NOT override it.
    const connectionLegs = this.resolveConnectionLegs(houseJobs, houseJob, masterJob);
    if (connectionLegs.length > 1) {
      return this.voyageInfoFromLegs(connectionLegs);
    }

    const transhipmentLegs = this.resolveTranshipmentVoyageLegs(transhipmentChain);
    if (transhipmentLegs.length > 1) {
      const primaryLeg = transhipmentLegs[0];

      return {
        vesselVoyage: this.formatVesselVoyage(primaryLeg.vesselName, primaryLeg.voyageNo),
        vesselName: primaryLeg.vesselName || null,
        voyageNo: primaryLeg.voyageNo || null,
        etd: primaryLeg.etd || null,
        eta: transhipmentLegs[transhipmentLegs.length - 1]?.eta || primaryLeg.eta || null,
        atd: primaryLeg.atd || null,
        ata: transhipmentLegs[transhipmentLegs.length - 1]?.ata || primaryLeg.ata || null,
        voyageLegs: transhipmentLegs,
      };
    }

    const masterVoyageLegs = (masterJob?.voyages || [])
      .map((voyage, index) => this.mapVoyageLeg(voyage, index + 1, houseJobs))
      .filter((leg) => leg.vesselName || leg.voyageNo || leg.etd || leg.eta || leg.atd || leg.ata);
    const fallbackHouseJobs = houseJobs?.length ? houseJobs : [houseJob].filter(Boolean);
    const fallbackLegs = fallbackHouseJobs
      .map((item, index) => this.mapHouseVoyageLeg(item, booking, index + 1))
      .filter((leg) => leg.vesselName || leg.voyageNo || leg.etd || leg.eta);
    let voyageLegs = this.mergeVoyageLegs(masterVoyageLegs.length ? masterVoyageLegs : fallbackLegs);
    // Last resort: a single connection leg, only when no Master/House voyage exists.
    if (!voyageLegs.length && connectionLegs.length === 1) {
      voyageLegs = connectionLegs;
    }
    const primaryLeg =
      voyageLegs.find((leg) => leg.atd || leg.etd || leg.ata || leg.eta || leg.vesselName || leg.voyageNo) ||
      this.mapHouseVoyageLeg(houseJob, booking, 1);

    return {
      vesselVoyage: this.formatVesselVoyage(primaryLeg.vesselName, primaryLeg.voyageNo),
      vesselName: primaryLeg.vesselName || null,
      voyageNo: primaryLeg.voyageNo || null,
      etd: primaryLeg.etd || null,
      eta: primaryLeg.eta || null,
      atd: primaryLeg.atd || null,
      ata: primaryLeg.ata || null,
      voyageLegs,
    };
  }

  private resolveTranshipmentVoyageLegs(chain: any) {
    if (!chain) return [];

    return [
      this.mapTranshipmentLeg(
        chain.sourceHouseJob,
        chain.sourceBooking,
        chain.sourceHouseJob?.masterJob,
        1,
        'First Leg',
      ),
      this.mapTranshipmentLeg(
        chain.linkedHouseJob,
        chain.linkedBooking,
        chain.linkedHouseJob?.masterJob,
        2,
        'Final Leg',
      ),
    ].filter((leg) => leg.vesselName || leg.voyageNo || leg.etd || leg.eta || leg.pol || leg.pod);
  }

  private mapTranshipmentLeg(houseJob: any, booking: any, masterJob: any, sequence: number, legType: string) {
    const masterVoyage = masterJob?.voyages?.[0];
    const vesselName = masterVoyage?.VesselName || houseJob?.VesselName || booking?.VesselName || null;
    const voyageNo = masterVoyage?.VoyageNo || houseJob?.VoyageNo || booking?.VoyageNo || null;

    return {
      sequence,
      legType,
      pol: houseJob?.POL || booking?.POL || masterJob?.POL || null,
      pod: houseJob?.POD || booking?.POD || masterJob?.POD || null,
      hblNos: this.uniqueValues([houseJob?.HBLNo || booking?.HBLNo]),
      shipmentNos: this.uniqueValues([houseJob?.ShipmentNo || booking?.ShipmentNo]),
      vesselVoyage: this.formatVesselVoyage(vesselName, voyageNo),
      vesselName,
      voyageNo,
      etd: masterVoyage?.ETD || houseJob?.ETD || booking?.ETD || null,
      eta: masterVoyage?.ETA || houseJob?.ETA || booking?.ETA || null,
      atd: masterVoyage?.ATD || null,
      ata: masterVoyage?.ATA || masterVoyage?.DestinationATA || null,
    };
  }

  private mapVoyageLeg(voyage: any, sequence: number, houseJobs: any[]) {
    return {
      sequence,
      hblNos: this.uniqueValues((houseJobs || []).map((item) => item?.HBLNo)),
      shipmentNos: this.uniqueValues((houseJobs || []).map((item) => item?.ShipmentNo)),
      vesselVoyage: this.formatVesselVoyage(voyage?.VesselName, voyage?.VoyageNo),
      vesselName: voyage?.VesselName || null,
      voyageNo: voyage?.VoyageNo || null,
      etd: voyage?.ETD || null,
      eta: voyage?.ETA || null,
      atd: voyage?.ATD || null,
      ata: voyage?.ATA || voyage?.DestinationATA || null,
    };
  }

  private mapHouseVoyageLeg(houseJob: any, booking: any, sequence: number) {
    return {
      sequence,
      hblNos: this.uniqueValues([houseJob?.HBLNo || booking?.HBLNo]),
      shipmentNos: this.uniqueValues([houseJob?.ShipmentNo || booking?.ShipmentNo]),
      vesselVoyage: this.formatVesselVoyage(
        houseJob?.VesselName || booking?.VesselName,
        houseJob?.VoyageNo || booking?.VoyageNo,
      ),
      vesselName: houseJob?.VesselName || booking?.VesselName || null,
      voyageNo: houseJob?.VoyageNo || booking?.VoyageNo || null,
      etd: houseJob?.ETD || booking?.ETD || null,
      eta: houseJob?.ETA || booking?.ETA || null,
      atd: null,
      ata: null,
    };
  }

  private mergeVoyageLegs(legs: any[]) {
    const merged = new Map<string, any>();
    for (const leg of legs || []) {
      const key = [
        this.normalizeReference(leg?.vesselName),
        this.normalizeReference(leg?.voyageNo),
        this.normalizeReference(leg?.etd),
        this.normalizeReference(leg?.eta),
        this.normalizeReference(leg?.atd),
        this.normalizeReference(leg?.ata),
      ].join('|');
      const existing = merged.get(key);
      if (existing) {
        existing.hblNos = this.uniqueValues([...(existing.hblNos || []), ...(leg.hblNos || [])]);
        existing.shipmentNos = this.uniqueValues([...(existing.shipmentNos || []), ...(leg.shipmentNos || [])]);
      } else {
        merged.set(key, { ...leg, sequence: merged.size + 1 });
      }
    }

    return Array.from(merged.values());
  }

  private formatVesselVoyage(vesselName: any, voyageNo: any) {
    return [vesselName, voyageNo].filter(Boolean).join(' / ') || null;
  }

  private resolveTransportMode(departmentMaster: any): 'AIR' | 'SEA' | 'ROAD' | 'OTHER' | null {
    const type = String(departmentMaster?.departmentType || '').trim().toUpperCase();
    if (type.includes('AIR')) return 'AIR';
    if (type.includes('SEA')) return 'SEA';
    if (type.includes('ROAD') || type.includes('TRANSPORT')) return 'ROAD';
    return type ? 'OTHER' : null;
  }

  private findDepartmentMaster(departmentMasterSid?: number | null): Promise<any> {
    if (!departmentMasterSid) return Promise.resolve(null);

    return this.db.departmentMaster.findFirst({
      where: { DepartmentMasterSid: departmentMasterSid },
      select: { departmentName: true, departmentType: true, ExportImport: true, FCLLCL: true },
    });
  }

  private mapBooking(booking: any) {
    if (!booking) return null;
    return {
      bookingHeaderSid: booking.BookingHeaderSid,
      bookingNo: booking.BookingNo,
      bookingDate: booking.BookingDateTime,
      bookingStatus: booking.BookingStatus,
      customerRefNo: booking.bookingOthers?.[0]?.CustomerRefNo || null,
      carrierBookingRef: booking.bookingOthers?.[0]?.CarrierBookingRef || null,
      etd: booking.ETD,
      eta: booking.ETA,
    };
  }

  private mapJob(masterJob: any, houseJob: any) {
    return {
      masterJobSid: masterJob?.MasterJobSid || null,
      masterJobNumber: masterJob?.MasterJobNumber || null,
      masterJobStatus: masterJob?.JobStatus || null,
      houseJobSid: houseJob?.HouseJobSid || null,
      shipmentNo: houseJob?.ShipmentNo || null,
      houseStatus: houseJob?.HouseStatus || null,
      hblNo: houseJob?.HBLNo || null,
      mblNo: masterJob?.MBLNo || houseJob?.MBLNo || null,
      voyages: masterJob?.voyages || [],
    };
  }

  // ---------------------------------------------------------------------------
  // Reference / search-type helpers
  // ---------------------------------------------------------------------------

  private normalizeSearchType(value: any): SearchType | null {
    const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!normalized) return null;
    if (normalized.includes('booking')) return 'booking';
    if (normalized.includes('hbl') || normalized.includes('hawb')) return 'hbl';
    if (normalized.includes('mbl') || normalized.includes('mawb')) return 'mbl';
    if (normalized.includes('container')) return 'container';
    if (normalized.includes('job') || normalized.includes('shipment')) return 'job';
    if (normalized.includes('house')) return 'hbl';
    if (normalized.includes('master')) return 'mbl';
    return null;
  }

  private searchTypeToDetected(searchType: SearchType | null, scope: TrackingScope) {
    switch (searchType) {
      case 'booking':
        return 'BOOKING';
      case 'hbl':
        return 'HBL';
      case 'mbl':
        return 'MBL';
      case 'job':
        return 'JOB';
      case 'container':
        return 'CONTAINER';
      default:
        if (scope === 'CONTAINER') return 'CONTAINER';
        if (scope === 'MASTER') return 'MBL';
        if (scope === 'BOOKING') return 'BOOKING';
        return 'HBL';
    }
  }

  private isTranshipmentType(value: any): boolean {
    const normalized = this.normalize(value);
    if (!normalized) return false;
    return (
      normalized.includes('transhipment') ||
      normalized.includes('transshipment') ||
      normalized === 'ts'
    );
  }

  private detectReferenceType(reference: string) {
    if (/^H(A)?WB/i.test(reference)) return 'HAWB';
    if (/^HBL/i.test(reference)) return 'HBL';
    if (/^M(A)?WB/i.test(reference)) return 'MAWB';
    if (/^MBL/i.test(reference)) return 'MBL';
    if (/^JOB/i.test(reference)) return 'JOB';
    if (/^SHIP/i.test(reference)) return 'SHIPMENT';
    if (/^BOOK|^BKG/i.test(reference)) return 'BOOKING';
    if (/^[A-Z]{4}\d{7}$/i.test(reference) || /^CONT/i.test(reference)) return 'CONTAINER';
    return 'UNKNOWN';
  }

  // ---------------------------------------------------------------------------
  // Selects
  // ---------------------------------------------------------------------------

  private bookingSelect(): any {
    return {
      BookingHeaderSid: true,
      CompanyMasterSid: true,
      BranchMasterSid: true,
      BookingNo: true,
      BookingDateTime: true,
      BookingStatus: true,
      ShipmentNo: true,
      HBLNo: true,
      MBLNo: true,
      CustomerName: true,
      POO: true,
      POL: true,
      POD: true,
      FPD: true,
      MovementType: true,
      JobType: true,
      VesselName: true,
      VoyageNo: true,
      ETD: true,
      ETA: true,
      PortCutoffDate: true,
      createdOn: true,
      updatedOn: true,
      departmentMaster: { select: { departmentName: true, departmentType: true, ExportImport: true, FCLLCL: true } },
      bookingOthers: { where: { status: 'A' }, select: { CustomerRefNo: true, CarrierBookingRef: true }, take: 1 },
      bookingCargo: {
        where: { status: 'A' },
        select: {
          BookingCargoSid: true,
          NoOfPackage: true,
          GrossWeight: true,
          Volume: true,
          containerType: { select: { ContainerCode: true, ContainerName: true } },
        },
      },
      bookingProduct: { where: { status: 'A' }, select: { CargoRecDate: true } },
      houseJob: { select: this.houseJobSelect(false) },
    };
  }

  private houseJobSelect(includeBooking: boolean): any {
    return {
      HouseJobSid: true,
      DepartmentMasterSid: true,
      CompanyMasterSid: true,
      BranchMasterSid: true,
      BookingHeaderSid: true,
      ShipmentNo: true,
      BookingNo: true,
      HBLNo: true,
      MBLNo: true,
      CustomerName: true,
      POO: true,
      POL: true,
      POD: true,
      FPD: true,
      MovementType: true,
      JobType: true,
      VesselName: true,
      VoyageNo: true,
      ETD: true,
      ETA: true,
      HouseStatus: true,
      TranshipmentBookingSid: true,
      createdOn: true,
      updatedOn: true,
      departmentMaster: { select: { departmentName: true, departmentType: true, ExportImport: true, FCLLCL: true } },
      ...(includeBooking ? { bookingHeader: { select: this.bookingSelectWithoutHouse() } } : {}),
      masterJob: { select: this.masterJobSelect(false) },
      Products: {
        where: { status: 'A' },
        select: {
          ContainerNo: true,
          MasterJobContainerSid: true,
          CargoRecDate: true,
          DeliveryDate: true,
          CFS: true,
          GrossWeight: true,
          NetWeight: true,
          Volume: true,
          ExternlQty: true,
          ActualQty: true,
          masterJobContainer: {
            select: {
              ContainerNumber: true,
              LineSeal: true,
              CustomsSeal: true,
              containerType: { select: { ContainerCode: true, ContainerName: true } },
            },
          },
        },
      },
      Connections: {
        where: { status: 'A' },
        orderBy: { HouseJobConnectionSid: 'asc' },
        select: {
          Mode: true,
          POL: true,
          POD: true,
          VesselName: true,
          VoyageNo: true,
          ETD: true,
          ETA: true,
        },
      },
      Cargo: {
        where: { status: 'A' },
        select: {
          GrossWeight: true,
          Volume: true,
          Volumetric: true,
          ChargeableWeight: true,
          NoOfPackage: true,
          NoofContainers: true,
        },
      },
    };
  }

  private bookingSelectWithoutHouse(): any {
    const select = this.bookingSelect();
    delete select.houseJob;
    return select;
  }

  private masterJobSelect(includeHouseJobs: boolean, context?: TrackingContext): any {
    return {
      MasterJobSid: true,
      MasterJobNumber: true,
      MBLNo: true,
      DepartmentMasterSid: true,
      POO: true,
      POL: true,
      POD: true,
      FPD: true,
      MovementType: true,
      JobStatus: true,
      PortCutoffDate: true,
      CreatedOn: true,
      containers: {
        where: { Status: 'A' },
        select: {
          MasterJobContainerSid: true,
          ContainerNumber: true,
          LineSeal: true,
          CustomsSeal: true,
          NoOfPkg: true,
          GrossWeight: true,
          Volume: true,
          containerType: { select: { ContainerCode: true, ContainerName: true } },
        },
      },
      voyages: {
        where: { Status: 'A' },
        orderBy: { MasterJobVoyageSid: 'asc' },
        select: { VesselName: true, VoyageNo: true, ETD: true, ETA: true, ATD: true, ATA: true, DestinationATA: true },
      },
      masterJobConnection: {
        where: { Status: 'A' },
        orderBy: { MasterJobConnectionSid: 'asc' },
        select: {
          Mode: true,
          POL: true,
          POD: true,
          VesselName: true,
          VoyageNo: true,
          ETD: true,
          ETA: true,
          ATD: true,
          ATA: true,
        },
      },
      others: { where: { Status: 'A' }, select: { StuffingStartDate: true }, take: 1 },
      ...(includeHouseJobs
        ? {
            houseJob: {
              where: { status: 'A', ...this.customerContextWhere(context) },
              select: this.houseJobSelect(true),
            },
          }
        : {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Context helpers / primitives
  // ---------------------------------------------------------------------------

  private normalizeTrackingContext(context: any): TrackingContext {
    return {
      CompanyMasterSid: this.toOptionalNumber(
        context?.CompanyMasterSid ?? context?.companyMasterSid ?? context?.companyCode,
      ),
      BranchMasterSid: this.toOptionalNumber(
        context?.BranchMasterSid ?? context?.branchMasterSid,
      ),
      CustomerMasterSid: this.toOptionalNumber(
        context?.CustomerMasterSid ?? context?.customerMasterSid,
      ),
      CustomerBranchSid: this.toOptionalNumber(
        context?.CustomerBranchSid ?? context?.customerBranchSid,
      ),
    };
  }

  private companyContextWhere(context?: TrackingContext) {
    return {
      ...(context?.CompanyMasterSid ? { CompanyMasterSid: context.CompanyMasterSid } : {}),
      ...(context?.BranchMasterSid ? { BranchMasterSid: context.BranchMasterSid } : {}),
    };
  }

  private customerContextWhere(context?: TrackingContext) {
    return {
      ...this.companyContextWhere(context),
      ...(context?.CustomerMasterSid ? { CustomerMasterSid: context.CustomerMasterSid } : {}),
      ...(context?.CustomerBranchSid ? { CustomerBranchSid: context.CustomerBranchSid } : {}),
    };
  }

  private hasCustomerContext(context?: TrackingContext) {
    return !!(context?.CustomerMasterSid || context?.CustomerBranchSid);
  }

  private toOptionalNumber(value: any): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  private normalize(value: string) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private normalizeReference(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private compact(values: any[]) {
    return values.filter((value, index, array) => value && array.indexOf(value) === index);
  }

  private uniqueValues(values: any[]) {
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== ''))];
  }

  private joinUnique(values: any[]) {
    return this.uniqueValues(values).join(', ');
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private addNullable(current: number | null, next: number | null) {
    if (current === null && next === null) return null;
    return (current || 0) + (next || 0);
  }

  private formatTime(date: any): string | null {
    if (!date) return null;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(11, 16);
  }
}
