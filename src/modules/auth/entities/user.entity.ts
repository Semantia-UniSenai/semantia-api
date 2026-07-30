export class User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: User) {
    Object.assign(this, props);
  }
}
