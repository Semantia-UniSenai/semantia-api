import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { SignInDto } from '../dtos/sign-in.dto';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class SignInUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async execute(dto: SignInDto): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(dto.email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      accessToken: await this.jwt.signAsync({
        sub: user.id,
        email: user.email,
        kind: 'account',
      }),
      user: { id: user.id, name: user.name, email: user.email },
    };
  }
}
