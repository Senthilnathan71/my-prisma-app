import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import * as jwt from "jsonwebtoken";

export const TokenPayload = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request: Request = ctx.switchToHttp().getRequest();
        const authHeader = request.headers["authorization"];

        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];

            try {
                const secret = process.env.JWT_SECRET;
                if (!secret) {
                    throw new Error('❌ JWT_SECRET is not defined');
                }
                const payload = jwt.verify(token, secret);
                return payload;
            } catch (error) {
                return null;
            }
        }
        return null;
    }
);
