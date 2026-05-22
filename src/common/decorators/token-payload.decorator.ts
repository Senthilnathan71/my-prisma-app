import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { extractAuthTokenFromRequest } from 'src/auth/auth/auth-cookie';

export const TokenPayload = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const token = extractAuthTokenFromRequest(request);

        if (!token) {
            return null;
        }

        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET is not defined');
            }

            return jwt.verify(token, secret);
        } catch (error) {
            return null;
        }
    }
);
