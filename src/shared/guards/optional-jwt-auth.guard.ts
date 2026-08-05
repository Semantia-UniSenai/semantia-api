import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import type { AuthUser } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [type, value] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !value) return true;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        kind?: string;
      }>(value);
      if (payload.kind && payload.kind !== 'account') return true;
      request.user = {
        userId: payload.sub,
        email: payload.email,
      } satisfies AuthUser;
    } catch {
      return true;
    }
    return true;
  }
}
