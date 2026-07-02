import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../shared/enums/user-role.enum';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { SchoolClass } from '../entities/school-class.entity';
import { ClassRepository } from '../repositories/class.repository';
import { JoinClassUseCase } from './join-class.usecase';

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

const schoolClass = new SchoolClass({
  id: 'class-1',
  name: 'Turma A',
  teacherId: 'teacher-1',
  inviteCode: 'ABCD2345',
  createdAt: new Date(),
});

const student: AuthUser = {
  userId: 'student-1',
  email: 'aluno@semantia.app',
  role: UserRole.ALUNO,
};

describe('JoinClassUseCase', () => {
  let useCase: JoinClassUseCase;
  let classes: jest.Mocked<ClassRepository>;

  beforeEach(() => {
    classes = buildRepo();
    useCase = new JoinClassUseCase(classes);
  });

  it('enrolls a new member by invite code', async () => {
    // Arrange
    classes.findByInviteCode.mockResolvedValue(schoolClass);
    classes.isMember.mockResolvedValue(false);

    // Act
    const result = await useCase.execute(student, 'ABCD2345');

    // Assert
    expect(classes.addMember).toHaveBeenCalledWith('class-1', 'student-1');
    expect(result).toBe(schoolClass);
  });

  it('is idempotent: joining twice returns the class without re-adding', async () => {
    // Arrange
    classes.findByInviteCode.mockResolvedValue(schoolClass);
    classes.isMember.mockResolvedValue(true);

    // Act
    const result = await useCase.execute(student, 'ABCD2345');

    // Assert
    expect(classes.addMember).not.toHaveBeenCalled();
    expect(result).toBe(schoolClass);
  });

  it('throws 404 for an invalid invite code', async () => {
    classes.findByInviteCode.mockResolvedValue(null);

    await expect(useCase.execute(student, 'NOPE9999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(classes.addMember).not.toHaveBeenCalled();
  });

  it('forbids the owning teacher from joining their own class', async () => {
    // Arrange
    classes.findByInviteCode.mockResolvedValue(schoolClass);
    const owner: AuthUser = {
      userId: 'teacher-1',
      email: 'prof@semantia.app',
      role: UserRole.PROFESSOR,
    };

    // Act / Assert
    await expect(useCase.execute(owner, 'ABCD2345')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(classes.addMember).not.toHaveBeenCalled();
  });
});
