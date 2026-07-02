import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { UserRole } from '../../../shared/enums/user-role.enum';
import {
  StudentClassSummary,
  TeacherClassSummary,
} from '../entities/school-class.entity';
import { ClassRepository } from '../repositories/class.repository';

/**
 * ListClasses — role-aware listing:
 * - PROFESSOR sees the classes they created, with member counts.
 * - ALUNO sees the classes they belong to, with the teacher's name.
 */
@Injectable()
export class ListClassesUseCase {
  constructor(private readonly classes: ClassRepository) {}

  execute(
    actor: AuthUser,
  ): Promise<TeacherClassSummary[] | StudentClassSummary[]> {
    if (actor.role === UserRole.PROFESSOR) {
      return this.classes.findByTeacher(actor.userId);
    }
    return this.classes.findByMember(actor.userId);
  }
}
