import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const UserData = createParamDecorator(
    (data: string, ctx: ExecutionContext)=>{
        const request = ctx.switchToHttp().getRequest();
        // console.log("decoratoruser",request);
        const user = request.user;
        // console.log("decoratoruser",user);
        return data ? user?.[data] : user;
    }
)