import { applyDecorators, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ApiCookieAuth, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { AUTH_COOKIE_NAME } from "src/auth/auth/auth-cookie";


export function Auth(){
    return applyDecorators(
        UseGuards(JwtAuthGuard),
        ApiCookieAuth(AUTH_COOKIE_NAME),
        ApiUnauthorizedResponse({ description : 'Unauthorized'})
    )
}
