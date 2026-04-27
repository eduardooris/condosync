import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

/**
 * Repositório do agregado `User`. Mantemos o uso do
 * `Repository<User>` do TypeORM por baixo, mas centralizamos as
 * queries aqui para alinhar com o padrão MVC do guia 2.2 e
 * evitar duplicação entre serviços.
 */
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  /** Compara e-mail sem diferenciar maiúsculas/minúsculas (login Keycloak vs cadastro local). */
  findByEmailNormalized(email: string): Promise<User | null> {
    const e = email.trim();
    if (!e) return Promise.resolve(null);
    return this.repo
      .createQueryBuilder('u')
      .where('LOWER(TRIM(u.email)) = LOWER(TRIM(:email))', { email: e })
      .getOne();
  }

  create(data: Partial<User>): User {
    return this.repo.create(data as User);
  }

  save(entity: User): Promise<User> {
    return this.repo.save(entity);
  }
}
