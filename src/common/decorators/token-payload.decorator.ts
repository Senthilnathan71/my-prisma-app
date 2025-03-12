import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { Request } from "express";
export const TokenPayload = createParamDecorator(

    (data: unknown, ctx: ExecutionContext) => {
        const request: Request = ctx.switchToHttp().getRequest()
        const authHeader = request.headers['authorization']
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];  // 'Bearer <token>'
            const payload = JSON.parse(atob(token.split(".")[1]))
            return payload
        }
        return null
    }
)