import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { SignUpDto } from '../dtos/sign-up.dto';
import { UserRepository } from '../repositories/user.repository';

/**
 * SignUp — registers a new user.
 * Fails with 409 Conflict if the email is already taken; otherwise hashes the
 * password, persists the user, and returns a freshly signed JWT.
 */
@Injectable()
export class SignUpUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async execute(dto: SignUpDto): Promise<AuthResponseDto> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }
}
