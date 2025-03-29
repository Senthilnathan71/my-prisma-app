import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { jwtConstants } from "src/auth/auth/constants";

export const TokenPayload = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request: Request = ctx.switchToHttp().getRequest();
        const authHeader = request.headers["authorization"];

        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];

            try {
                const payload = jwt.verify(token, jwtConstants.secret);
                return payload;
            } catch (error) {
                return null;
            }
        }
        return null;
    }
);
