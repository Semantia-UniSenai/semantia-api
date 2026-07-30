import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AuthUser {
  userId: string;
  email: string;
}

export interface OptionalAuthRequest extends Request {
  user?: AuthUser;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        kind?: string;
      }>(token);
      if (payload.kind && payload.kind !== 'account') {
        throw new Error('wrong token kind');
      }
      request.user = { userId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, value] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? value : undefined;
  }
}
