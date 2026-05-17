<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## OpenAPI

Com a API rodando, a documentação fica disponível em:

- UI Swagger: `http://localhost:3000/api/docs`
- JSON OpenAPI: `http://localhost:3000/api/openapi.json`
- YAML OpenAPI: `http://localhost:3000/api/openapi.yaml`

Gerar tipos TypeScript a partir do OpenAPI:

```bash
npm run openapi:sync
```

Isso baixa `openapi.json` e gera `src/types/openapi.generated.ts`.

## RBAC, Keycloak Admin API e convites

Este projeto usa o Keycloak não só para autenticar via OIDC, mas também
para criar/gerenciar usuários através da **Admin API** (endpoint `/auth/register`
e fluxo de convites). Isso exige um cliente confidencial dedicado:

| Cliente             | Uso                                                    |
| ------------------- | ------------------------------------------------------ |
| `condo-frontend`    | OIDC público (login do usuário no SPA)                 |
| `condo-backend-admin` | **Service account** que cria usuários, atribui/remove roles, reseta senha |

As envs relevantes:

```bash
KEYCLOAK_ADMIN_CLIENT_ID=condo-backend-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=condo-backend-admin-dev-secret  # sobrescreva em prod
APP_PUBLIC_URL=http://localhost:5173                          # base p/ links de convite
```

> **Atenção (primeira aplicação local):** ao puxar essas mudanças,
> apague o volume do banco do Keycloak antes de subir o stack para que
> o realm seja reimportado com o novo cliente `condo-backend-admin` e
> a role `condo-admin`:
>
> ```bash
> docker compose down
> docker volume rm condosync_keycloak_pgdata   # nome pode variar conforme o projeto compose
> docker compose up -d
> ```
>
> Em ambientes onde derrubar o volume não é aceitável, crie o cliente
> `condo-backend-admin` manualmente no admin do Keycloak (com `service
> accounts` habilitado e os roles `manage-users`, `view-users`,
> `query-users`, `view-realm` do `realm-management`) e cadastre a role
> `condo-admin` no realm.

### Papéis (roles)

- **realm role `condo-admin`** (Keycloak): bit global "este usuário pode
  criar condomínios". Atribuída por padrão no signup direto e
  **removida** quando o usuário entra via convite (apenas como morador).
- **`UserCondominium.role`** (banco): papel **dentro** de um condomínio
  específico — `ADMIN`, `SUB_ADMIN`, `RESPONSIBLE`, `RESIDENT`. É essa
  role que controla as ações por condomínio (criar/editar/etc.).

### Fluxo de convites

- `POST /condominiums/:id/invitations` — cria convite (ADMIN/SUB_ADMIN).
  Retorna `url` **uma única vez** (token bruto não é persistido, apenas
  o hash SHA-256).
- `GET /invitations/:token` — preview público (mostra condomínio + role
  antes do aceite).
- `POST /invitations/:token/accept` — aceita: cria usuário no Keycloak
  (sem `condo-admin`) ou vincula um existente, e devolve um par de
  tokens para auto-login. `EMAIL_DIRECT` aprova na hora;
  `GENERIC_LINK` cria uma membership `PENDING` que precisa de aprovação.
- `GET /condominiums/:id/members/pending` + `POST .../approve|reject` —
  fila de aprovação para ADMIN/SUB_ADMIN.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment (CondoSync — EC2)

Na VPS a API é buildada na própria máquina (`infra/docker-compose.build.yml`)
e atualizada com `infra/scripts/deploy-api.sh` ou `scripts/vps-rebuild.sh api`
(`docker compose up -d --build --no-deps api` + healthcheck).

Detalhes operacionais completos em [`../infra/README.md`](../infra/README.md).

### Migrações TypeORM

O `entrypoint.sh` do container executa `migration:run` antes de subir o
processo Node. Para pular em emergências, defina `SKIP_MIGRATIONS=1`.

Comandos locais:

```bash
npm run typeorm:gen -- src/database/migrations/<nome>   # gera nova migration
npm run typeorm:run                                     # aplica pendentes
npm run typeorm:revert                                  # reverte a última
```

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
