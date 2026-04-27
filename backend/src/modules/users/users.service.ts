import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../../database/entities/user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async ensureFromAuth(params: {
    id: string;
    email: string;
    fullName?: string | null;
  }): Promise<User> {
    let user = await this.users.findById(params.id);
    if (!user) {
      user = this.users.create({
        id: params.id,
        email: params.email,
        fullName: params.fullName ?? null,
      });
      return this.users.save(user);
    }
    let dirty = false;
    if (user.email !== params.email) {
      user.email = params.email;
      dirty = true;
    }
    if (params.fullName !== undefined && params.fullName !== user.fullName) {
      user.fullName = params.fullName;
      dirty = true;
    }
    if (dirty) {
      return this.users.save(user);
    }
    return user;
  }

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async updateProfile(
    userId: string,
    patch: { fullName?: string | null; phoneWhatsapp?: string | null },
  ): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (patch.fullName !== undefined) {
      const v = patch.fullName?.trim() ?? '';
      user.fullName = v === '' ? null : v;
    }
    if (patch.phoneWhatsapp !== undefined) {
      const v = patch.phoneWhatsapp?.trim() ?? '';
      user.phoneWhatsapp = v === '' ? null : v;
    }
    return this.users.save(user);
  }

  /** Usado no fluxo “esqueci minha senha” (lookup por e-mail da conta). */
  findByEmailNormalized(email: string): Promise<User | null> {
    return this.users.findByEmailNormalized(email);
  }
}
