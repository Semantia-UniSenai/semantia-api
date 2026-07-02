import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { ClassRepository } from '../../classes/repositories/class.repository';
import { LiveSession } from '../entities/live-session.entity';
import { LiveSessionRepository } from '../repositories/live-session.repository';

/**
 * ListClassSessions — a class's sessions, most recent first. Visible to the
 * owning teacher and enrolled students.
 */
@Injectable()
export class ListClassSessionsUseCase {
  constructor(
    private readonly sessions: LiveSessionRepository,
    private readonly classes: ClassRepository,
  ) {}

  async execute(actor: AuthUser, classId: string): Promise<LiveSession[]> {
    const schoolClass = await this.classes.findById(classId);
    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    const isOwner = schoolClass.teacherId === actor.userId;
    if (!isOwner && !(await this.classes.isMember(classId, actor.userId))) {
      throw new ForbiddenException('You do not have access to this class');
    }

    return this.sessions.findByClass(classId);
  }
}
