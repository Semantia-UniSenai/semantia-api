import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('generated/prisma');
const destination = resolve('dist/generated/prisma');

if (!existsSync(source)) {
  throw new Error('Prisma client was not generated before packaging');
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(resolve('dist/generated'), { recursive: true });
cpSync(source, destination, { recursive: true });
