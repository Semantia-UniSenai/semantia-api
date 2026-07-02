import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../shared/enums/user-role.enum';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { SchoolClass } from '../entities/school-class.entity';
import { ClassRepository } from '../repositories/class.repository';
import { CreateClassUseCase } from './create-class.usecase';

const buildRepo = (): jest.Mocked<ClassRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByInviteCode: jest.fn(),
  findByTeacher: jest.fn(),
  findByMember: jest.fn(),
  findMembers: jest.fn(),
  isMember: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
});

const teacher: AuthUser = {
  userId: 'teacher-1',
  email: 'prof@semantia.app',
  role: UserRole.PROFESSOR,
};

const student: AuthUser = {
  userId: 'student-1',
  email: 'aluno@semantia.app',
  role: UserRole.ALUNO,
};

describe('CreateClassUseCase', () => {
  let useCase: CreateClassUseCase;
  let classes: jest.Mocked<ClassRepository>;

  beforeEach(() => {
    classes = buildRepo();
    useCase = new CreateClassUseCase(classes);
  });

  it('creates a class with a generated invite code for a teacher', async () => {
    // Arrange
    classes.findByInviteCode.mockResolvedValue(null);
    classes.create.mockImplementation((data) =>
      Promise.resolve(
        new SchoolClass({ id: 'class-1', createdAt: new Date(), ...data }),
      ),
    );

    // Act
    const result = await useCase.execute(teacher, { name: 'Turma A' });

    // Assert
    const createArg = classes.create.mock.calls[0][0];
    expect(createArg.name).toBe('Turma A');
    expect(createArg.teacherId).toBe('teacher-1');
    expect(createArg.inviteCode).toMatch(
      /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/,
    );
    expect(result.id).toBe('class-1');
  });

  it('rejects a student trying to create a class', async () => {
    await expect(
      useCase.execute(student, { name: 'Turma A' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(classes.create).not.toHaveBeenCalled();
  });

  it('retries on invite code collision and uses the next free code', async () => {
    // Arrange — first candidate taken, second free
    classes.findByInviteCode
      .mockResolvedValueOnce(
        new SchoolClass({
          id: 'other',
          name: 'X',
          teacherId: 't',
          inviteCode: 'TAKEN123',
          createdAt: new Date(),
        }),
      )
      .mockResolvedValueOnce(null);
    classes.create.mockImplementation((data) =>
      Promise.resolve(
        new SchoolClass({ id: 'class-1', createdAt: new Date(), ...data }),
      ),
    );

    // Act
    await useCase.execute(teacher, { name: 'Turma A' });

    // Assert
    expect(classes.findByInviteCode).toHaveBeenCalledTimes(2);
    expect(classes.create).toHaveBeenCalledTimes(1);
  });

  it('gives up after repeated collisions', async () => {
    // Arrange — every candidate taken
    classes.findByInviteCode.mockResolvedValue(
      new SchoolClass({
        id: 'other',
        name: 'X',
        teacherId: 't',
        inviteCode: 'TAKEN123',
        createdAt: new Date(),
      }),
    );

    // Act / Assert
    await expect(
      useCase.execute(teacher, { name: 'Turma A' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(classes.create).not.toHaveBeenCalled();
  });
});
