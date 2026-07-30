import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { SignUpDto } from '../dtos/sign-up.dto';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class SignUpUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async execute(dto: SignUpDto): Promise<AuthResponseDto> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const user = await this.users.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(dto.password, 10),
    });
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
