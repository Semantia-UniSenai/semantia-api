import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../shared/enums/user-role.enum';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { ClassMemberInfo, SchoolClass } from '../entities/school-class.entity';
import { ClassRepository } from '../repositories/class.repository';
import { GetClassUseCase } from './get-class.usecase';

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

const member: AuthUser = {
  userId: 'student-1',
  email: 'aluno@semantia.app',
  role: UserRole.ALUNO,
};

describe('GetClassUseCase', () => {
  let useCase: GetClassUseCase;
  let classes: jest.Mocked<ClassRepository>;

  beforeEach(() => {
    classes = buildRepo();
    useCase = new GetClassUseCase(classes);
  });

  it('returns detail with members for the owning teacher', async () => {
    // Arrange
    const members = [
      new ClassMemberInfo({
        userId: 'student-1',
        name: 'Ana',
        email: 'ana@semantia.app',
        joinedAt: new Date(),
      }),
    ];
    classes.findById.mockResolvedValue(schoolClass);
    classes.findMembers.mockResolvedValue(members);

    // Act
    const result = await useCase.execute(owner, 'class-1');

    // Assert — owner never triggers a membership lookup
    expect(result.members).toBe(members);
    expect(result.id).toBe('class-1');
    expect(classes.isMember).not.toHaveBeenCalled();
  });

  it('returns detail for an enrolled student', async () => {
    // Arrange
    classes.findById.mockResolvedValue(schoolClass);
    classes.isMember.mockResolvedValue(true);
    classes.findMembers.mockResolvedValue([]);

    // Act / Assert
    await expect(useCase.execute(member, 'class-1')).resolves.toMatchObject({
      id: 'class-1',
    });
    expect(classes.isMember).toHaveBeenCalledWith('class-1', 'student-1');
  });

  it('rejects a user who is neither owner nor member', async () => {
    // Arrange
    classes.findById.mockResolvedValue(schoolClass);
    classes.isMember.mockResolvedValue(false);

    // Act / Assert
    await expect(useCase.execute(member, 'class-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws 404 for an unknown class', async () => {
    classes.findById.mockResolvedValue(null);

    await expect(useCase.execute(owner, 'ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
