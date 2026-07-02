import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { SignUpUseCase } from './sign-up.usecase';

describe('SignUpUseCase', () => {
  let useCase: SignUpUseCase;
  let users: jest.Mocked<UserRepository>;
  let jwt: jest.Mocked<JwtService>;

  const buildUser = (over: Partial<User> = {}): User =>
    new User({
      id: 'user-1',
      name: 'Ana Souza',
      email: 'ana@semantia.app',
      passwordHash: 'hashed',
      role: UserRole.ALUNO,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    });

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    jwt = { signAsync: jest.fn() } as unknown as jest.Mocked<JwtService>;
    useCase = new SignUpUseCase(users, jwt);
  });

  it('creates the user, hashes the password and returns a token', async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(buildUser());
    jwt.signAsync.mockResolvedValue('signed.jwt.token');

    // Act
    const result = await useCase.execute({
      name: 'Ana Souza',
      email: 'ana@semantia.app',
      password: 'sup3rsecret',
    });

    // Assert
    expect(users.findByEmail).toHaveBeenCalledWith('ana@semantia.app');
    const createArg = users.create.mock.calls[0][0];
    expect(createArg.passwordHash).not.toBe('sup3rsecret');
    await expect(
      bcrypt.compare('sup3rsecret', createArg.passwordHash),
    ).resolves.toBe(true);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'ana@semantia.app',
      role: UserRole.ALUNO,
    });
    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      user: {
        id: 'user-1',
        name: 'Ana Souza',
        email: 'ana@semantia.app',
        role: UserRole.ALUNO,
      },
    });
  });

  it('defaults the role to ALUNO when the DTO omits it', async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(buildUser());
    jwt.signAsync.mockResolvedValue('signed.jwt.token');

    // Act
    await useCase.execute({
      name: 'Ana Souza',
      email: 'ana@semantia.app',
      password: 'sup3rsecret',
    });

    // Assert
    expect(users.create.mock.calls[0][0].role).toBe(UserRole.ALUNO);
  });

  it('persists and signs the PROFESSOR role when requested', async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(buildUser({ role: UserRole.PROFESSOR }));
    jwt.signAsync.mockResolvedValue('signed.jwt.token');

    // Act
    const result = await useCase.execute({
      name: 'Ana Souza',
      email: 'ana@semantia.app',
      password: 'sup3rsecret',
      role: UserRole.PROFESSOR,
    });

    // Assert
    expect(users.create.mock.calls[0][0].role).toBe(UserRole.PROFESSOR);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'ana@semantia.app',
      role: UserRole.PROFESSOR,
    });
    expect(result.user.role).toBe(UserRole.PROFESSOR);
  });

  it('throws ConflictException when the email is already registered', async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(buildUser());

    // Act / Assert
    await expect(
      useCase.execute({
        name: 'Ana Souza',
        email: 'ana@semantia.app',
        password: 'sup3rsecret',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.create).not.toHaveBeenCalled();
  });
});
