import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SchoolClass } from '../../classes/entities/school-class.entity';
import {
  buildClassRepo,
  buildSession,
  buildSessionRepo,
  studentActor,
  teacherActor,
} from '../testing/session-test.helpers';
import { ListClassSessionsUseCase } from './list-class-sessions.usecase';

describe('ListClassSessionsUseCase', () => {
  let useCase: ListClassSessionsUseCase;
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
    useCase = new ListClassSessionsUseCase(sessions, classes);
  });

  it('lists sessions for the owning teacher', async () => {
    // Arrange
    classes.findById.mockResolvedValue(ownClass);
    const list = [buildSession({ classId: 'class-1' })];
    sessions.findByClass.mockResolvedValue(list);

    // Act / Assert
    await expect(useCase.execute(teacherActor, 'class-1')).resolves.toBe(list);
    expect(classes.isMember).not.toHaveBeenCalled();
  });

  it('lists sessions for an enrolled student', async () => {
    // Arrange
    classes.findById.mockResolvedValue(ownClass);
    classes.isMember.mockResolvedValue(true);
    sessions.findByClass.mockResolvedValue([]);

    // Act
    await useCase.execute(studentActor, 'class-1');

    // Assert
    expect(classes.isMember).toHaveBeenCalledWith('class-1', 'student-1');
    expect(sessions.findByClass).toHaveBeenCalledWith('class-1');
  });

  it('rejects a user who is neither owner nor member', async () => {
    classes.findById.mockResolvedValue(ownClass);
    classes.isMember.mockResolvedValue(false);

    await expect(
      useCase.execute(studentActor, 'class-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.findByClass).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown class', async () => {
    classes.findById.mockResolvedValue(null);

    await expect(useCase.execute(teacherActor, 'ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
