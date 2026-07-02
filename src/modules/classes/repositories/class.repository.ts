import {
  ClassMemberInfo,
  SchoolClass,
  StudentClassSummary,
  TeacherClassSummary,
} from '../entities/school-class.entity';

export interface CreateClassData {
  name: string;
  teacherId: string;
  inviteCode: string;
}

/**
 * ClassRepository — abstract contract for class (turma) persistence and
 * membership. Registered as a DI token (abstract class) so the Prisma
 * implementation can be swapped without touching business logic.
 */
export abstract class ClassRepository {
  abstract create(data: CreateClassData): Promise<SchoolClass>;
  abstract findById(id: string): Promise<SchoolClass | null>;
  abstract findByInviteCode(inviteCode: string): Promise<SchoolClass | null>;
  abstract findByTeacher(teacherId: string): Promise<TeacherClassSummary[]>;
  abstract findByMember(userId: string): Promise<StudentClassSummary[]>;
  abstract findMembers(classId: string): Promise<ClassMemberInfo[]>;
  abstract isMember(classId: string, userId: string): Promise<boolean>;
  abstract addMember(classId: string, userId: string): Promise<void>;
  abstract removeMember(classId: string, userId: string): Promise<boolean>;
}
