import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../guards/jwt-auth.guard';

/**
 * @CurrentUser() — extracts the authenticated principal that JwtAuthGuard
 * placed on the request. Only meaningful on routes protected by the guard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthUser;
  },
);
