/**
 * Domain representation of a class (turma). Plain class — no Prisma coupling.
 * Repository implementations map Prisma rows into this shape inline.
 */
export class SchoolClass {
  id: string;
  name: string;
  teacherId: string;
  inviteCode: string;
  createdAt: Date;

  constructor(props: SchoolClass) {
    Object.assign(this, props);
  }
}

/** A class as listed for its teacher: includes how many students joined. */
export class TeacherClassSummary extends SchoolClass {
  memberCount: number;

  constructor(props: TeacherClassSummary) {
    super(props);
    this.memberCount = props.memberCount;
  }
}

/** A class as listed for a student member: includes the teacher's name. */
export class StudentClassSummary extends SchoolClass {
  teacherName: string;

  constructor(props: StudentClassSummary) {
    super(props);
    this.teacherName = props.teacherName;
  }
}

/** One enrolled student, as shown in the class detail. */
export class ClassMemberInfo {
  userId: string;
  name: string;
  email: string;
  joinedAt: Date;

  constructor(props: ClassMemberInfo) {
    Object.assign(this, props);
  }
}
