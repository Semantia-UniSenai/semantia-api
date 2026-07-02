/**
 * UserRole — domain-level role enum, mirrored by the Prisma `Role` enum.
 * Lives in shared/ so entities, guards and gateways can use it without
 * importing anything from the generated Prisma client.
 */
export enum UserRole {
  PROFESSOR = 'PROFESSOR',
  ALUNO = 'ALUNO',
}
