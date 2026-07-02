import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../shared/enums/user-role.enum';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { SchoolClass } from '../entities/school-class.entity';
import { ClassRepository } from '../repositories/class.repository';
import { RemoveMemberUseCase } from './remove-member.usecase';

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

const owner: AuthUser = {
  userId: 'teacher-1',
  email: 'prof@semantia.app',
  role: UserRole.PROFESSOR,
};

describe('RemoveMemberUseCase', () => {
  let useCase: RemoveMemberUseCase;
  let classes: jest.Mocked<ClassRepository>;

  beforeEach(() => {
    classes = buildRepo();
    useCase = new RemoveMemberUseCase(classes);
  });

  it('lets the owning teacher remove a student', async () => {
    // Arrange
    classes.findById.mockResolvedValue(schoolClass);
    classes.removeMember.mockResolvedValue(true);

    // Act
    await useCase.execute(owner, 'class-1', 'student-1');

    // Assert
    expect(classes.removeMember).toHaveBeenCalledWith('class-1', 'student-1');
  });

  it('rejects anyone who is not the owning teacher', async () => {
    // Arrange
    classes.findById.mockResolvedValue(schoolClass);
    const otherTeacher: AuthUser = {
      userId: 'teacher-2',
      email: 'outro@semantia.app',
      role: UserRole.PROFESSOR,
    };

    // Act / Assert
    await expect(
      useCase.execute(otherTeacher, 'class-1', 'student-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(classes.removeMember).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown class', async () => {
    classes.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(owner, 'ghost', 'student-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 404 when the user is not a member', async () => {
    classes.findById.mockResolvedValue(schoolClass);
    classes.removeMember.mockResolvedValue(false);

    await expect(
      useCase.execute(owner, 'class-1', 'stranger'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
