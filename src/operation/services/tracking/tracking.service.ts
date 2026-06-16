import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as fs from 'fs';
import * as path from 'path';

type TrackingState = 'completed' | 'current' | 'pending' | 'exception';

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

const STANDARD_EVENTS = [
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

@Injectable()
export class TrackingService {
  constructor(private readonly db: DatabaseService) {}

  async search(referenceNo: string, context: any = {}) {
    const reference = String(referenceNo || '').trim();
    if (!reference) {
      throw new BadRequestException('Reference number is required');
    }
    const trackingContext = this.normalizeTrackingContext(context);

    const booking = await this.findBooking(reference, trackingContext);
    const houseJob = booking?.houseJob || (await this.findHouseJob(reference, trackingContext));
    const masterJob = houseJob?.masterJob || (await this.findMasterJob(reference, trackingContext));

    if (!booking && !houseJob && !masterJob) {
      throw new NotFoundException(`No tracking record found for ${reference}`);
    }

    const resolvedBooking = booking || houseJob?.bookingHeader || null;
    const resolvedHouseJob = houseJob || masterJob?.houseJob?.[0] || null;
    let resolvedMasterJob = masterJob || resolvedHouseJob?.masterJob || null;

    if (this.shouldLoadMasterHouseJobs(reference, resolvedHouseJob, resolvedMasterJob)) {
      resolvedMasterJob =
        (await this.findMasterJobBySid(resolvedMasterJob.MasterJobSid, trackingContext)) ||
        resolvedMasterJob;
    }

    const resolvedHouseJobs = this.resolveHouseJobs(reference, resolvedHouseJob, resolvedMasterJob, resolvedBooking);
    const containers = this.resolveContainers(resolvedMasterJob, resolvedHouseJobs, resolvedBooking);
    const shipmentNo =
      resolvedHouseJob?.ShipmentNo ||
      resolvedBooking?.ShipmentNo ||
      resolvedMasterJob?.MasterJobNumber ||
      null;
    const milestones = await this.resolveMilestones(
      reference,
      shipmentNo,
      resolvedBooking,
      resolvedHouseJob,
      resolvedMasterJob,
      resolvedHouseJobs,
      containers,
    );
    const documents = await this.resolveDocuments(reference, resolvedBooking, resolvedHouseJob);
    const currentStatus = this.deriveCurrentStatus(milestones);
    const detectedReferenceType = this.detectMatchedReferenceType(
      reference,
      resolvedBooking,
      resolvedHouseJob,
      resolvedMasterJob,
      containers,
    );
    const transhipmentChain = await this.resolveTranshipmentChain(
      resolvedBooking,
      resolvedHouseJob,
      trackingContext,
    );
    const voyageInfo = this.resolveVoyageInfo(
      resolvedBooking,
      resolvedHouseJob,
      resolvedMasterJob,
      resolvedHouseJobs,
      transhipmentChain,
    );
    const departmentMaster =
      resolvedHouseJob?.departmentMaster ||
      resolvedBooking?.departmentMaster ||
      (await this.findDepartmentMaster(resolvedMasterJob?.DepartmentMasterSid)) ||
      null;
    const transportMode = this.resolveTransportMode(departmentMaster);

    return {
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
        department:
          departmentMaster?.departmentName ||
          null,
        departmentType: departmentMaster?.departmentType || null,
        transportMode,
        segment: departmentMaster?.FCLLCL || null,
        exportImport: departmentMaster?.ExportImport || null,
        jobType:
          resolvedHouseJob?.JobType ||
          resolvedBooking?.JobType ||
          resolvedHouseJob?.MovementType ||
          resolvedBooking?.MovementType ||
          resolvedMasterJob?.MovementType ||
          null,
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
      milestones,
      documents,
      currentStatus,
      summary: {
        searchedReference: reference,
        detectedReferenceType,
        matchedReferenceType: detectedReferenceType,
        totalContainers: containers.length,
        totalDocuments: documents.length,
        completedMilestones: milestones.filter((item) =>
          ['completed', 'current'].includes(item.state),
        ).length,
        nextMilestone: milestones.find((item) => item.state === 'pending') || null,
      },
    };
  }

  getByBooking(bookingNo: string, context: any = {}) {
    return this.search(bookingNo, context);
  }

  getByHbl(hblNo: string, context: any = {}) {
    return this.search(hblNo, context);
  }

  getByMbl(mblNo: string, context: any = {}) {
    return this.search(mblNo, context);
  }

  getByContainer(containerNo: string, context: any = {}) {
    return this.search(containerNo, context);
  }

  getByJob(jobNo: string, context: any = {}) {
    return this.search(jobNo, context);
  }

  private findBooking(reference: string, context: TrackingContext): Promise<any> {
    return this.db.bookingHeader.findFirst({
      where: {
        status: 'A',
        ...this.customerContextWhere(context),
        OR: [
          { BookingNo: { equals: reference, mode: 'insensitive' } },
          { HBLNo: { equals: reference, mode: 'insensitive' } },
          { MBLNo: { equals: reference, mode: 'insensitive' } },
          { ShipmentNo: { equals: reference, mode: 'insensitive' } },
          {
            bookingOthers: {
              some: { status: 'A', CustomerRefNo: { equals: reference, mode: 'insensitive' } },
            },
          },
        ],
      },
      select: this.bookingSelect(),
    });
  }

  private findHouseJob(reference: string, context: TrackingContext): Promise<any> {
    return this.db.houseJob.findFirst({
      where: {
        status: 'A',
        ...this.customerContextWhere(context),
        OR: [
          { BookingNo: { equals: reference, mode: 'insensitive' } },
          { HBLNo: { equals: reference, mode: 'insensitive' } },
          { MBLNo: { equals: reference, mode: 'insensitive' } },
          { ShipmentNo: { equals: reference, mode: 'insensitive' } },
          { Products: { some: { status: 'A', ContainerNo: { equals: reference, mode: 'insensitive' } } } },
          { masterJob: { MasterJobNumber: { equals: reference, mode: 'insensitive' } } },
          { masterJob: { MBLNo: { equals: reference, mode: 'insensitive' } } },
          {
            masterJob: {
              containers: {
                some: { Status: 'A', ContainerNumber: { equals: reference, mode: 'insensitive' } },
              },
            },
          },
        ],
      },
      select: this.houseJobSelect(true),
    });
  }

  private findMasterJob(reference: string, context: TrackingContext): Promise<any> {
    return this.db.masterJob.findFirst({
      where: {
        Status: 'A',
        ...this.companyContextWhere(context),
        ...(this.hasCustomerContext(context)
          ? { houseJob: { some: { status: 'A', ...this.customerContextWhere(context) } } }
          : {}),
        OR: [
          { MasterJobNumber: { equals: reference, mode: 'insensitive' } },
          { MBLNo: { equals: reference, mode: 'insensitive' } },
          {
            containers: {
              some: { Status: 'A', ContainerNumber: { equals: reference, mode: 'insensitive' } },
            },
          },
          { houseJob: { some: { status: 'A', BookingNo: { equals: reference, mode: 'insensitive' } } } },
          { houseJob: { some: { status: 'A', HBLNo: { equals: reference, mode: 'insensitive' } } } },
          { houseJob: { some: { status: 'A', ShipmentNo: { equals: reference, mode: 'insensitive' } } } },
        ],
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

  private async resolveMilestones(
    reference: string,
    shipmentNo: string | null,
    booking: any,
    houseJob: any,
    masterJob: any,
    houseJobs: any[] = [],
    containers: any[] = [],
  ): Promise<TrackingMilestone[]> {
    const stored = await this.findStoredMilestones(reference, booking, houseJob, masterJob, houseJobs, containers);

    const actual = stored.length
      ? stored.map((item, index) => ({
          eventName: item.MilestoneName,
          eventDate: item.MilestoneDate,
          eventTime: this.formatTime(item.MilestoneDate),
          location: this.resolveLocation(item.MilestoneName, booking, houseJob, masterJob),
          remarks: item.Remarks,
          state: 'completed' as TrackingState,
          source: item.source,
          sequence: index + 1,
        }))
      : this.generateMilestones(booking, houseJob, masterJob);

    return this.applyTimelineState(actual);
  }

  private async findStoredMilestones(
    reference: string,
    booking: any,
    houseJob: any,
    masterJob: any,
    houseJobs: any[] = [],
    containers: any[] = [],
  ) {
    const isBookingScreen = this.isBookingReference(reference, booking);
    const isMasterScreen = this.isMasterReference(reference, masterJob);
    const isContainerScreen = this.isContainerReference(reference, containers);

    if (isBookingScreen && booking?.BookingNo) {
      return this.findBookingScreenMilestones(booking);
    }

    if (!this.isHouseReference(reference, houseJob) && (isMasterScreen || isContainerScreen)) {
      return this.findMasterJobScreenMilestones(reference, houseJobs, containers);
    }

    if (houseJob?.ShipmentNo || houseJob?.HBLNo) {
      return this.findHouseJobScreenMilestones(houseJob, booking);
    }

    if (booking?.BookingNo) {
      return this.findBookingScreenMilestones(booking);
    }

    return [];
  }

  private async findMasterJobScreenMilestones(reference: string, houseJobs: any[], containers: any[]) {
    const normalizedReference = this.normalizeReference(reference);
    const matchedContainer = containers.find(
      (container) => this.normalizeReference(container?.containerNo) === normalizedReference,
    );
    const relevantHouseJobSids = new Set((matchedContainer?.houseJobSids || []).map(Number));
    const relevantHouseJobs = relevantHouseJobSids.size
      ? houseJobs.filter((item) => relevantHouseJobSids.has(Number(item?.HouseJobSid)))
      : houseJobs;

    const houseShipmentNos = relevantHouseJobs
      .map((item) => item?.ShipmentNo || item?.HBLNo)
      .filter((shipmentNo): shipmentNo is string => !!shipmentNo);
    const bookingNos = relevantHouseJobs
      .map((item) => item?.bookingHeader?.BookingNo || item?.BookingNo)
      .filter((bookingNo): bookingNo is string => !!bookingNo);
    const houseMilestones = await this.findMilestonesByShipmentNos(houseShipmentNos, 'HOUSE');
    const bookingMilestones = await this.findMilestonesByShipmentNos(bookingNos, 'BOOKING');

    return [...houseMilestones, ...bookingMilestones].sort(this.sortMilestones);
  }

  private async findBookingScreenMilestones(booking: any) {
    const houseJobs = booking?.BookingHeaderSid
      ? await this.db.houseJob.findMany({
          where: {
            status: 'A',
            BookingHeaderSid: booking.BookingHeaderSid,
            ShipmentNo: { not: null },
          },
          select: { ShipmentNo: true },
        })
      : [];

    const bookingMilestones = booking?.BookingNo
      ? await this.findMilestonesByShipmentNos([booking.BookingNo], 'BOOKING')
      : [];
    const houseMilestones = await this.findMilestonesByShipmentNos(
      houseJobs
        .map((item) => item.ShipmentNo)
        .filter((shipmentNo): shipmentNo is string => !!shipmentNo),
      'HOUSE',
    );

    return [...bookingMilestones, ...houseMilestones].sort(this.sortMilestones);
  }

  private async findHouseJobScreenMilestones(houseJob: any, booking: any) {
    const houseShipmentNo = houseJob?.ShipmentNo || houseJob?.HBLNo;
    const bookingNo = houseJob?.bookingHeader?.BookingNo || booking?.BookingNo;

    const houseMilestones = houseShipmentNo
      ? await this.findMilestonesByShipmentNos([houseShipmentNo], 'HOUSE')
      : [];
    const bookingMilestones =
      houseJob?.BookingHeaderSid && bookingNo
        ? await this.findMilestonesByShipmentNos([bookingNo], 'BOOKING')
        : [];

    return [...houseMilestones, ...bookingMilestones].sort(this.sortMilestones);
  }

  private findMilestonesByShipmentNos(shipmentNos: string[], source: 'BOOKING' | 'HOUSE') {
    const uniqueShipmentNos = [...new Set(shipmentNos.filter(Boolean))];
    if (!uniqueShipmentNos.length) return [];

    return this.db.shipmentMilestone
      .findMany({
        where: {
          Status: 'A',
          ShipmentNo: { in: uniqueShipmentNos },
        },
        orderBy: [{ MilestoneDate: 'asc' }, { CreatedOn: 'asc' }],
        select: { MilestoneName: true, MilestoneDate: true, Remarks: true, CreatedOn: true },
      })
      .then((items) => items.map((item) => ({ ...item, source })));
  }

  private isBookingReference(reference: string, booking: any) {
    const normalizedReference = this.normalizeReference(reference);
    return [booking?.BookingNo, booking?.ShipmentNo]
      .filter(Boolean)
      .some((item) => this.normalizeReference(item) === normalizedReference);
  }

  private isHouseReference(reference: string, houseJob: any) {
    const normalizedReference = this.normalizeReference(reference);
    return [houseJob?.BookingNo, houseJob?.ShipmentNo, houseJob?.HBLNo]
      .filter(Boolean)
      .some((item) => this.normalizeReference(item) === normalizedReference);
  }

  private shouldLoadMasterHouseJobs(reference: string, houseJob: any, masterJob: any) {
    if (!masterJob?.MasterJobSid) return false;
    const normalizedReference = this.normalizeReference(reference);

    return [
      masterJob?.MasterJobNumber,
      masterJob?.MBLNo,
      houseJob?.MBLNo,
      ...(masterJob?.containers || []).map((container) => container?.ContainerNumber),
      ...(houseJob?.Products || []).map((product) => product?.ContainerNo),
    ]
      .filter(Boolean)
      .some((item) => this.normalizeReference(item) === normalizedReference);
  }

  private isMasterReference(reference: string, masterJob: any) {
    const normalizedReference = this.normalizeReference(reference);
    return [masterJob?.MasterJobNumber, masterJob?.MBLNo]
      .filter(Boolean)
      .some((item) => this.normalizeReference(item) === normalizedReference);
  }

  private isContainerReference(reference: string, containers: any[]) {
    const normalizedReference = this.normalizeReference(reference);
    return containers.some((container) => this.normalizeReference(container?.containerNo) === normalizedReference);
  }

  private sortMilestones(a: any, b: any) {
    const dateA = new Date(a.MilestoneDate || a.CreatedOn || 0).getTime();
    const dateB = new Date(b.MilestoneDate || b.CreatedOn || 0).getTime();
    return dateA - dateB;
  }

  private async resolveDocuments(
    reference: string,
    booking: any,
    houseJob: any,
  ): Promise<TrackingDocument[]> {
    const isBookingScreen = this.isBookingReference(reference, booking);

    if (isBookingScreen && booking?.BookingHeaderSid) {
      return this.findBookingScreenDocuments(booking);
    }

    if (houseJob?.HouseJobSid) {
      return this.findHouseJobScreenDocuments(houseJob, booking);
    }

    if (booking?.BookingHeaderSid) {
      return this.findBookingScreenDocuments(booking);
    }

    return [];
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

  private async findHouseJobScreenDocuments(
    houseJob: any,
    booking: any,
  ): Promise<TrackingDocument[]> {
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
          where: { status: 'A' },
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
      where: { AttachDocumentSid: attachDocumentSid, status: 'A' },
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

  private generateMilestones(booking: any, houseJob: any, masterJob: any): TrackingMilestone[] {
    const firstProduct =
      houseJob?.Products?.find((item) => item.CargoRecDate) ||
      booking?.bookingProduct?.find((item) => item.CargoRecDate);
    const voyage = masterJob?.voyages?.[0];
    const stuffingDate = masterJob?.others?.[0]?.StuffingStartDate;
    const deliveredProduct = houseJob?.Products?.find((item) => item.DeliveryDate);

    return [
      this.event('Booking Created', booking?.createdOn || houseJob?.createdOn || masterJob?.CreatedOn, booking?.POL || houseJob?.POL || masterJob?.POL, 'booking'),
      this.event('Cargo Received', firstProduct?.CargoRecDate, firstProduct?.CFS || booking?.POL || houseJob?.POL, 'house_job'),
      this.event('Container Stuffing', stuffingDate, masterJob?.POL || houseJob?.POL || booking?.POL, 'container'),
      this.event('Gate In', masterJob?.PortCutoffDate || booking?.PortCutoffDate, masterJob?.POL || houseJob?.POL || booking?.POL, 'container'),
      this.event('Customs Cleared', null, masterJob?.POL || houseJob?.POL || booking?.POL, 'system'),
      this.event('Loaded On Vessel', voyage?.ETD || houseJob?.ETD || booking?.ETD, masterJob?.POL || houseJob?.POL || booking?.POL, 'voyage'),
      this.event('Vessel Departed', voyage?.ATD || voyage?.ETD || houseJob?.ETD || booking?.ETD, masterJob?.POL || houseJob?.POL || booking?.POL, 'voyage'),
      this.event('Transshipment', null, null, 'voyage'),
      this.event('Vessel Arrived', voyage?.ATA || voyage?.ETA || houseJob?.ETA || booking?.ETA, masterJob?.POD || houseJob?.POD || booking?.POD, 'voyage'),
      this.event('Container Discharged', voyage?.DestinationATA || voyage?.ATA, masterJob?.POD || houseJob?.POD || booking?.POD, 'container'),
      this.event('Out For Delivery', null, houseJob?.FPD || booking?.FPD || masterJob?.FPD, 'system'),
      this.event('Delivered', deliveredProduct?.DeliveryDate, houseJob?.FPD || booking?.FPD || masterJob?.FPD, 'house_job'),
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

  private applyTimelineState(events: TrackingMilestone[]): TrackingMilestone[] {
    const normalized = STANDARD_EVENTS.map((name, index) => {
      const found = events.find((item) => this.normalize(item.eventName) === this.normalize(name));
      return found ? { ...found, eventName: name, sequence: index + 1 } : this.event(name, null, null, 'system');
    });
    const latestCompleted = Math.max(
      0,
      ...normalized.map((item, index) => (item.eventDate ? index : -1)),
    );
    return normalized.map((item, index) => ({
      ...item,
      sequence: index + 1,
      state: index < latestCompleted ? 'completed' : index === latestCompleted ? 'current' : 'pending',
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

  private resolveContainers(masterJob: any, houseJobs: any[], booking: any) {
    const containers = new Map<string, any>();
    for (const container of masterJob?.containers || []) {
      containers.set(container.ContainerNumber.toUpperCase(), {
        containerNo: container.ContainerNumber,
        containerType: container.containerType?.ContainerName || container.containerType?.ContainerCode || null,
        sealNo: container.LineSeal || container.CustomsSeal || null,
        packageCount: container.NoOfPkg ?? null,
        weight: this.toNumber(container.GrossWeight),
        volume: this.toNumber(container.Volume),
        hblNos: [],
        houseJobSids: [],
        shipmentNos: [],
        commodityCount: 0,
        productWeight: null,
        productVolume: null,
        productPackageCount: null,
      });
    }
    for (const houseJob of houseJobs || []) {
      for (const product of houseJob?.Products || []) {
        if (!product.ContainerNo) continue;
        const key = product.ContainerNo.toUpperCase();
        const existing = containers.get(key) || {
          containerNo: product.ContainerNo,
          containerType: product.masterJobContainer?.containerType?.ContainerName || product.masterJobContainer?.containerType?.ContainerCode || null,
          sealNo: product.masterJobContainer?.LineSeal || product.masterJobContainer?.CustomsSeal || null,
          packageCount: null,
          weight: null,
          volume: null,
          hblNos: [],
          houseJobSids: [],
          shipmentNos: [],
          commodityCount: 0,
          productWeight: null,
          productVolume: null,
          productPackageCount: null,
        };

        existing.containerType = existing.containerType || product.masterJobContainer?.containerType?.ContainerName || product.masterJobContainer?.containerType?.ContainerCode || null;
        existing.sealNo = existing.sealNo || product.masterJobContainer?.LineSeal || product.masterJobContainer?.CustomsSeal || null;
        existing.productPackageCount = this.addNullable(existing.productPackageCount, this.toNumber(product.ActualQty));
        existing.productWeight = this.addNullable(existing.productWeight, this.toNumber(product.GrossWeight));
        existing.productVolume = this.addNullable(existing.productVolume, this.toNumber(product.Volume));
        existing.commodityCount += 1;
        if (houseJob?.HBLNo) existing.hblNos.push(houseJob.HBLNo);
        if (houseJob?.HouseJobSid) existing.houseJobSids.push(houseJob.HouseJobSid);
        if (houseJob?.ShipmentNo) existing.shipmentNos.push(houseJob.ShipmentNo);
        containers.set(key, existing);
      }
    }
    if (!containers.size) {
      for (const cargo of booking?.bookingCargo || []) {
        containers.set(`BOOKING-${cargo.BookingCargoSid}`, {
          containerNo: 'Pending container assignment',
          containerType: cargo.containerType?.ContainerName || cargo.containerType?.ContainerCode || null,
          sealNo: null,
          packageCount: cargo.NoOfPackage ?? null,
          weight: this.toNumber(cargo.GrossWeight),
          volume: this.toNumber(cargo.Volume),
          hblNos: [],
          houseJobSids: [],
          shipmentNos: [],
          commodityCount: 1,
        });
      }
    }
    return Array.from(containers.values()).map((container) => {
      const hblNos = this.uniqueValues(container.hblNos);
      const houseJobSids = this.uniqueValues(container.houseJobSids);
      const shipmentNos = this.uniqueValues(container.shipmentNos);

      return {
        ...container,
        hblNos,
        hblNo: this.joinUnique(hblNos),
        houseJobSids,
        shipmentNos,
        packageCount: container.productPackageCount ?? container.packageCount,
        weight: container.productWeight ?? container.weight,
        volume: container.productVolume ?? container.volume,
      };
    });
  }

  private resolveHouseJobs(reference: string, houseJob: any, masterJob: any, booking: any) {
    if (this.isHouseReference(reference, houseJob) && !this.isMasterReference(reference, masterJob)) {
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

  private async resolveTranshipmentChain(booking: any, houseJob: any, context: TrackingContext) {
    const isTranshipment = String(houseJob?.JobType || booking?.JobType || '').toLowerCase() === 'transhipment';
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

  private resolveVoyageInfo(booking: any, houseJob: any, masterJob: any, houseJobs: any[], transhipmentChain?: any) {
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
    const voyageLegs = this.mergeVoyageLegs(masterVoyageLegs.length ? masterVoyageLegs : fallbackLegs);
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

  private detectMatchedReferenceType(
    reference: string,
    booking: any,
    houseJob: any,
    masterJob: any,
    containers: any[],
  ) {
    const matches = (...values: any[]) =>
      values.some((value) => this.normalizeReference(value) === this.normalizeReference(reference));

    if (matches(booking?.BookingNo, houseJob?.BookingNo)) return 'BOOKING';
    if (matches(booking?.HBLNo, houseJob?.HBLNo)) return 'HBL';
    if (matches(booking?.MBLNo, houseJob?.MBLNo, masterJob?.MBLNo)) return 'MBL';
    if (matches(masterJob?.MasterJobNumber)) return 'JOB';
    if (matches(houseJob?.ShipmentNo, booking?.ShipmentNo)) return 'SHIPMENT';
    if (containers?.some((container) => matches(container?.containerNo))) return 'CONTAINER';

    return this.detectReferenceType(reference);
  }

  private bookingSelect(): any {
    return {
      BookingHeaderSid: true,
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
          CargoRecDate: true,
          DeliveryDate: true,
          CFS: true,
          GrossWeight: true,
          Volume: true,
          ActualQty: true,
          masterJobContainer: {
            select: {
              LineSeal: true,
              CustomsSeal: true,
              containerType: { select: { ContainerCode: true, ContainerName: true } },
            },
          },
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
