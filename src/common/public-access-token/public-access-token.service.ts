import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { DatabaseService } from 'src/database/database.service';

export const PUBLIC_RESOURCE_MENU_CODES = {
  QUOTATION: 'QUA',
} as const;

export const PUBLIC_TOKEN_PURPOSES = {
  FORGOT_PASSWORD: 'FORGOT_PASSWORD',
} as const;

export type PublicTokenPurpose =
  (typeof PUBLIC_TOKEN_PURPOSES)[keyof typeof PUBLIC_TOKEN_PURPOSES];

export type PublicResourceMenuCode =
  (typeof PUBLIC_RESOURCE_MENU_CODES)[keyof typeof PUBLIC_RESOURCE_MENU_CODES];

export type PublicAccessTokenErrorCode = 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_USED';

export class PublicAccessTokenError extends Error {
  constructor(public readonly code: PublicAccessTokenErrorCode) {
    super(code);
    this.name = 'PublicAccessTokenError';
  }
}

interface IssueParams {
  menuCode: PublicResourceMenuCode;
  resourceSid: number;
  ttlHours: number;
  sentToEmail?: string;
  createdBy?: string;
}

interface IssueResult {
  token: string;
  expiresAt: Date;
  publicAccessTokenSid: number;
}

@Injectable()
export class PublicAccessTokenService implements OnModuleInit {
  private readonly logger = new Logger(PublicAccessTokenService.name);
  private readonly menuCodeToSid = new Map<string, number>();

  constructor(private readonly _db: DatabaseService) {}

  async onModuleInit() {
    await this.refreshMenuCodeMap();
  }

  async refreshMenuCodeMap() {
    const codes = Object.values(PUBLIC_RESOURCE_MENU_CODES);
    const rows = await this._db.menuMaster.findMany({
      where: { MenuCode: { in: codes } },
      select: { MenuMasterSid: true, MenuCode: true },
    });
    this.menuCodeToSid.clear();
    for (const r of rows) {
      this.menuCodeToSid.set(r.MenuCode.trim(), r.MenuMasterSid);
    }
    for (const code of codes) {
      if (!this.menuCodeToSid.has(code)) {
        this.logger.warn(
          `MenuMaster row not found for MenuCode '${code}'. Public token operations for this code will fail until seeded.`,
        );
      }
    }
  }

  private resolveMenuSid(menuCode: PublicResourceMenuCode): number {
    const sid = this.menuCodeToSid.get(menuCode);
    if (!sid) {
      throw new Error(
        `MenuMaster row missing for MenuCode '${menuCode}'. Seed the menu before issuing public tokens.`,
      );
    }
    return sid;
  }

  isSupportedMenuSid(menuMasterSid: number): boolean {
    for (const sid of this.menuCodeToSid.values()) {
      if (sid === menuMasterSid) return true;
    }
    return false;
  }

  async issue(params: IssueParams): Promise<IssueResult> {
    const menuMasterSid = this.resolveMenuSid(params.menuCode);
    return this.issueByMenuSid({
      menuMasterSid,
      resourceSid: params.resourceSid,
      ttlHours: params.ttlHours,
      sentToEmail: params.sentToEmail,
      createdBy: params.createdBy,
    });
  }

  async issueByMenuSid(params: {
    menuMasterSid: number;
    resourceSid: number;
    ttlHours: number;
    sentToEmail?: string;
    createdBy?: string;
  }): Promise<IssueResult> {
    if (!this.isSupportedMenuSid(params.menuMasterSid)) {
      throw new Error(
        `MenuMasterSid ${params.menuMasterSid} is not registered for public access tokens.`,
      );
    }
    const expiresAt = new Date(Date.now() + params.ttlHours * 60 * 60 * 1000);
    const token = crypto.randomBytes(32).toString('base64url');

    const row = await this._db.$transaction(async (tx) => {
      await tx.publicAccessToken.updateMany({
        where: {
          MenuMasterSid: params.menuMasterSid,
          ResourceSid: params.resourceSid,
          UsedAt: null,
        },
        data: {
          UsedAt: new Date(),
          updatedBy: params.createdBy ?? 'SYSTEM',
        },
      });

      return tx.publicAccessToken.create({
        data: {
          Token: token,
          MenuMasterSid: params.menuMasterSid,
          ResourceSid: params.resourceSid,
          ExpiresAt: expiresAt,
          SentToEmail: params.sentToEmail,
          createdBy: params.createdBy,
        },
      });
    });

    return {
      token,
      expiresAt,
      publicAccessTokenSid: row.PublicAccessTokenSid,
    };
  }

  async findValid(token: string, expectedMenuCode: PublicResourceMenuCode) {
    const expectedSid = this.resolveMenuSid(expectedMenuCode);
    const row = await this._db.publicAccessToken.findUnique({
      where: { Token: token },
    });
    if (!row || row.MenuMasterSid !== expectedSid) {
      throw new PublicAccessTokenError('NOT_FOUND');
    }
    if (row.UsedAt !== null) {
      throw new PublicAccessTokenError('ALREADY_USED');
    }
    if (row.ExpiresAt.getTime() <= Date.now()) {
      throw new PublicAccessTokenError('EXPIRED');
    }
    return row;
  }

  async consume(
    publicAccessTokenSid: number,
    tx: Prisma.TransactionClient,
    updatedBy = 'PUBLIC_LINK',
  ) {
    await tx.publicAccessToken.update({
      where: { PublicAccessTokenSid: publicAccessTokenSid },
      data: { UsedAt: new Date(), updatedBy },
    });
  }

  async issueByPurpose(params: {
    purpose: PublicTokenPurpose;
    resourceSid: number;
    ttlMinutes: number;
    sentToEmail?: string;
    createdBy?: string;
  }): Promise<IssueResult> {
    const expiresAt = new Date(Date.now() + params.ttlMinutes * 60 * 1000);
    const token = crypto.randomBytes(32).toString('base64url');

    const row = await this._db.$transaction(async (tx) => {
      await tx.publicAccessToken.updateMany({
        where: {
          Purpose: params.purpose,
          ResourceSid: params.resourceSid,
          UsedAt: null,
        },
        data: {
          UsedAt: new Date(),
          updatedBy: params.createdBy ?? 'SYSTEM',
        },
      });

      return tx.publicAccessToken.create({
        data: {
          Token: token,
          Purpose: params.purpose,
          ResourceSid: params.resourceSid,
          ExpiresAt: expiresAt,
          SentToEmail: params.sentToEmail,
          createdBy: params.createdBy,
        },
      });
    });

    return {
      token,
      expiresAt,
      publicAccessTokenSid: row.PublicAccessTokenSid,
    };
  }

  async findValidByPurpose(token: string, expectedPurpose: PublicTokenPurpose) {
    const row = await this._db.publicAccessToken.findUnique({
      where: { Token: token },
    });
    if (!row || row.Purpose !== expectedPurpose) {
      throw new PublicAccessTokenError('NOT_FOUND');
    }
    if (row.UsedAt !== null) {
      throw new PublicAccessTokenError('ALREADY_USED');
    }
    if (row.ExpiresAt.getTime() <= Date.now()) {
      throw new PublicAccessTokenError('EXPIRED');
    }
    return row;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this._db.publicAccessToken.deleteMany({
      where: {
        OR: [
          { ExpiresAt: { lt: new Date() } },
          { UsedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }
}
