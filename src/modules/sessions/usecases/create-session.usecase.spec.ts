import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SchoolClass } from '../../classes/entities/school-class.entity';
import {
  buildClassRepo,
  buildSession,
  buildSessionRepo,
  studentActor,
  teacherActor,
} from '../testing/session-test.helpers';
import { CreateSessionUseCase } from './create-session.usecase';

describe('CreateSessionUseCase', () => {
  let useCase: CreateSessionUseCase;
  let sessions: ReturnType<typeof buildSessionRepo>;
  let classes: ReturnType<typeof buildClassRepo>;

  const ownClass = new SchoolClass({
    id: 'class-1',
    name: 'Turma A',
    teacherId: 'teacher-1',
    inviteCode: 'ABCD2345',
    createdAt: new Date(),
  });

  beforeEach(() => {
    sessions = buildSessionRepo();
    classes = buildClassRepo();
    useCase = new CreateSessionUseCase(sessions, classes);
  });

  it('creates an ad-hoc LIVE session with a generated join token', async () => {
    // Arrange
    sessions.create.mockImplementation((data) =>
      Promise.resolve(buildSession({ ...data })),
    );

    // Act
    const result = await useCase.execute(teacherActor, { title: 'Aula 1' });

    // Assert
    const createArg = sessions.create.mock.calls[0][0];
    expect(createArg.teacherId).toBe('teacher-1');
    expect(createArg.classId).toBeNull();
    expect(createArg.joinToken).toMatch(/^[A-Za-z0-9_-]{10,}$/);
    expect(result.title).toBe('Aula 1');
    expect(classes.findById).not.toHaveBeenCalled();
  });

  it('creates a class-bound session when the teacher owns the class', async () => {
    // Arrange
    classes.findById.mockResolvedValue(ownClass);
    sessions.create.mockImplementation((data) =>
      Promise.resolve(buildSession({ ...data })),
    );

    // Act
    await useCase.execute(teacherActor, {
      title: 'Aula 1',
      classId: 'class-1',
    });

    // Assert
    expect(sessions.create.mock.calls[0][0].classId).toBe('class-1');
  });

  it('rejects a student trying to start a session', async () => {
    await expect(
      useCase.execute(studentActor, { title: 'Aula 1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects a teacher starting a session for someone else’s class', async () => {
    // Arrange
    classes.findById.mockResolvedValue(
      new SchoolClass({ ...ownClass, teacherId: 'teacher-2' }),
    );

    // Act / Assert
    await expect(
      useCase.execute(teacherActor, { title: 'Aula 1', classId: 'class-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('throws 404 when the class does not exist', async () => {
    classes.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(teacherActor, { title: 'Aula 1', classId: 'ghost' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
