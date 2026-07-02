import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { SignInUseCase } from './sign-in.usecase';

describe('SignInUseCase', () => {
  let useCase: SignInUseCase;
  let users: jest.Mocked<UserRepository>;
  let jwt: jest.Mocked<JwtService>;

  const password = 'sup3rsecret';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4);
  });

  const buildUser = (): User =>
    new User({
      id: 'user-1',
      name: 'Ana Souza',
      email: 'ana@semantia.app',
      passwordHash,
      role: UserRole.PROFESSOR,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    jwt = { signAsync: jest.fn() } as unknown as jest.Mocked<JwtService>;
    useCase = new SignInUseCase(users, jwt);
  });

  it('returns a token when credentials are valid', async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(buildUser());
    jwt.signAsync.mockResolvedValue('signed.jwt.token');

    // Act
    const result = await useCase.execute({
      email: 'ana@semantia.app',
      password,
    });

    // Assert — the JWT payload and the response both carry the role
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'ana@semantia.app',
      role: UserRole.PROFESSOR,
    });
    expect(result.user).toEqual({
      id: 'user-1',
      name: 'Ana Souza',
      email: 'ana@semantia.app',
      role: UserRole.PROFESSOR,
    });
  });

  it('throws UnauthorizedException for an unknown email', async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(null);

    // Act / Assert
    await expect(
      useCase.execute({ email: 'nobody@semantia.app', password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the password is wrong', async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(buildUser());

    // Act / Assert
    await expect(
      useCase.execute({ email: 'ana@semantia.app', password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
