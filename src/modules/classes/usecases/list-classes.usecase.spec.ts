import { UserRole } from '../../../shared/enums/user-role.enum';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import {
  StudentClassSummary,
  TeacherClassSummary,
} from '../entities/school-class.entity';
import { ClassRepository } from '../repositories/class.repository';
import { ListClassesUseCase } from './list-classes.usecase';

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

describe('ListClassesUseCase', () => {
  let useCase: ListClassesUseCase;
  let classes: jest.Mocked<ClassRepository>;

  beforeEach(() => {
    classes = buildRepo();
    useCase = new ListClassesUseCase(classes);
  });

  it('lists a teacher’s own classes with member counts', async () => {
    // Arrange
    const teacher: AuthUser = {
      userId: 'teacher-1',
      email: 'prof@semantia.app',
      role: UserRole.PROFESSOR,
    };
    const summaries = [
      new TeacherClassSummary({
        id: 'class-1',
        name: 'Turma A',
        teacherId: 'teacher-1',
        inviteCode: 'ABCD2345',
        createdAt: new Date(),
        memberCount: 12,
      }),
    ];
    classes.findByTeacher.mockResolvedValue(summaries);

    // Act / Assert
    await expect(useCase.execute(teacher)).resolves.toBe(summaries);
    expect(classes.findByTeacher).toHaveBeenCalledWith('teacher-1');
    expect(classes.findByMember).not.toHaveBeenCalled();
  });

  it('lists a student’s memberships with the teacher name', async () => {
    // Arrange
    const student: AuthUser = {
      userId: 'student-1',
      email: 'aluno@semantia.app',
      role: UserRole.ALUNO,
    };
    const summaries = [
      new StudentClassSummary({
        id: 'class-1',
        name: 'Turma A',
        teacherId: 'teacher-1',
        inviteCode: 'ABCD2345',
        createdAt: new Date(),
        teacherName: 'Carlos Lima',
      }),
    ];
    classes.findByMember.mockResolvedValue(summaries);

    // Act / Assert
    await expect(useCase.execute(student)).resolves.toBe(summaries);
    expect(classes.findByMember).toHaveBeenCalledWith('student-1');
    expect(classes.findByTeacher).not.toHaveBeenCalled();
  });
});
