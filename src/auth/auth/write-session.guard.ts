import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserSessionService } from './user-session.service';

@Injectable()
export class WriteSessionGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userSessionService: UserSessionService,
  ) {}

  private getToken(req: Request): string | null {
    const authorization = req.headers.authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      return authorization.replace('Bearer ', '').trim();
    }

    const cookieToken = (req as any).cookies?.crm_session;
    return typeof cookieToken === 'string' && cookieToken.trim() ? cookieToken : null;
  }

  private getScreenId(req: Request): string | null {
    const bodyScreenId = (req.body as any)?.screenId;
    const queryScreenId = (req.query as any)?.screenId;
    const paramsScreenId = (req.params as any)?.screenId;
    const headerScreenId = req.headers['x-screen-id'];

    return (
      bodyScreenId ||
      queryScreenId ||
      paramsScreenId ||
      (typeof headerScreenId === 'string' ? headerScreenId : null)
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();

    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return true;
    }

    const token = this.getToken(req);
    if (!token) {
      throw new ForbiddenException('Authentication required for write operations.');
    }

    const payload = this.jwtService.decode(token) as any;
    const userId = Number(payload?.id ?? payload?.sub);
    const sessionKey = payload?.sessionToken || payload?.sessionKey;

    if (!userId || !sessionKey) {
      throw new ForbiddenException('Invalid session token for write operation.');
    }

    const screenId = this.getScreenId(req);
    if (!screenId) {
      throw new ForbiddenException('Screen ID is required for write operations.');
    }

    await this.userSessionService.assertWritable(userId, String(screenId), String(sessionKey));

    return true;
  }
}
