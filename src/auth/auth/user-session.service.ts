import { ForbiddenException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UserSessionService {
  constructor(private readonly db: DatabaseService) {}

  private get userSessionDelegate(): any {
    return (this.db as any).userSession;
  }

  private hasUserSessionModel(): boolean {
    return !!(this.db as any)?.userSession;
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async registerScreenSession(input: {
    userId: number;
    screenId: string;
    sessionKey: string;
    socketId?: string | null;
    tokenHash?: string | null;
  }) {
    if (!this.hasUserSessionModel()) {
      return {
        readOnly: false,
        sessionId: 0,
      };
    }

    const screenId = input.screenId?.trim();

    if (!screenId) {
      throw new Error('screenId is required to register a session.');
    }

    const activeSessions = await this.userSessionDelegate.findMany({
      where: {
        UserMasterSid: input.userId,
        screenId,
        isActive: true,
      },
    });

    for (const session of activeSessions) {
      if (session.sessionKey === input.sessionKey) {
        continue;
      }

      await this.userSessionDelegate.update({
        where: { UserSessionSid: session.UserSessionSid },
        data: {
          isActive: false,
          isPrimary: false,
          isReadOnly: true,
          status: 'SECONDARY',
          endedAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
    }

    const currentSession = activeSessions.find(
      (session) => session.sessionKey === input.sessionKey,
    );

    if (currentSession) {
      await this.userSessionDelegate.update({
        where: { UserSessionSid: currentSession.UserSessionSid },
        data: {
          isActive: true,
          isPrimary: true,
          isReadOnly: false,
          status: 'ACTIVE',
          socketId: input.socketId ?? currentSession.socketId,
          tokenHash: input.tokenHash ?? currentSession.tokenHash,
          lastSeenAt: new Date(),
          endedAt: null,
        },
      });

      return {
        readOnly: false,
        sessionId: currentSession.UserSessionSid,
      };
    }

    const created = await this.userSessionDelegate.create({
      data: {
        UserMasterSid: input.userId,
        screenId,
        sessionKey: input.sessionKey,
        socketId: input.socketId ?? null,
        tokenHash: input.tokenHash ?? null,
        isActive: true,
        isPrimary: true,
        isReadOnly: false,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      },
    });

    return {
      readOnly: false,
      sessionId: created.UserSessionSid,
    };
  }

  async assertWritable(userId: number, screenId: string, sessionKey: string): Promise<boolean> {
    if (!this.hasUserSessionModel()) {
      return true;
    }

    const session = await this.userSessionDelegate.findFirst({
      where: {
        UserMasterSid: userId,
        screenId,
        sessionKey,
        isActive: true,
      },
    });

    if (!session) {
      throw new ForbiddenException('This session is not active for this screen.');
    }

    if (session.isReadOnly || session.status === 'SECONDARY') {
      throw new ForbiddenException(
        'This session is active elsewhere. You are in read-only mode.',
      );
    }

    await this.userSessionDelegate.update({
      where: { UserSessionSid: session.UserSessionSid },
      data: {
        lastSeenAt: new Date(),
      },
    });

    return true;
  }

  async releaseSession(userId: number, screenId: string, sessionKey: string) {
    await this.userSessionDelegate.updateMany({
      where: {
        UserMasterSid: userId,
        screenId,
        sessionKey,
      },
      data: {
        isActive: false,
        isPrimary: false,
        isReadOnly: false,
        status: 'CLOSED',
        endedAt: new Date(),
      },
    });
  }
}
