import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { SignInDto } from '../dtos/sign-in.dto';
import { UserRepository } from '../repositories/user.repository';

/**
 * SignIn — authenticates an existing user.
 * Throws 401 Unauthorized for both unknown email and wrong password (same
 * message) to avoid leaking which accounts exist.
 */
@Injectable()
export class SignInUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async execute(dto: SignInDto): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
