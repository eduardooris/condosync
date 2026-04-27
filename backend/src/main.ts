import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
// `compression` é CommonJS puro (`module.exports = function`). Como o
// tsconfig não habilita `esModuleInterop`, o `import default` quebra em
// runtime (`compression_1.default is not a function`). Usamos `require`
// direto para garantir o callable.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const compression =
  require('compression') as () => import('express').RequestHandler;
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ErrorResponseDto } from './common/dto/error-response.dto';

const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  app.setGlobalPrefix(API_PREFIX);

  const isProd = process.env.NODE_ENV === 'production';

  // ── Segurança HTTP ────────────────────────────────────────────────
  app.use(
    helmet({
      // CSP é gerenciado pelo nginx/edge — o Swagger UI quebra com
      // a CSP padrão do helmet (inline scripts).
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  // ── CORS ──────────────────────────────────────────────────────────
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (isProd && corsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS deve ser configurado em produção (lista separada por vírgula).',
    );
  }
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  // ── Validação global ──────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
      // Mantém compatibilidade com o filtro: o `BadRequestException`
      // já carrega `message: string[]` quando há múltiplos erros.
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: 'Bad Request',
          message: errors.flatMap((e) =>
            e.constraints
              ? Object.values(e.constraints)
              : [`Campo '${e.property}' inválido.`],
          ),
        }),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Swagger ───────────────────────────────────────────────────────
  const swagger = new DocumentBuilder()
    .setTitle('CondoSync API')
    .setDescription(
      'Backend NestJS do CondoSync — gestão de condomínios, ' +
        'cobranças, mural, ocorrências, enquetes e dashboard. ' +
        'Multi-tenant por `condominium_id` extraído do membership do usuário.',
    )
    .setVersion(process.env.IMAGE_TAG ?? '1.0.0')
    .setContact('CondoSync', 'https://condosync.app', 'dev@condosync.app')
    .setLicense('UNLICENSED', 'https://condosync.app/license')
    .addServer('http://localhost:3000', 'Local')
    .addServer('https://api.condosync.app', 'Produção')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT emitido pelo Keycloak (realm `main`).',
      },
      'bearer',
    )
    .addTag('health', 'Healthchecks da API')
    .addTag('auth', 'Login, logout e perfil do usuário autenticado')
    .addTag('condominiums', 'Cadastro e membership de condomínios')
    .addTag('units', 'Unidades por condomínio')
    .addTag('residents', 'Moradores e responsável financeiro')
    .addTag('charges', 'Arrecadação — cobranças mensais')
    .addTag('expenses', 'Despesas com comprovante')
    .addTag('polls', 'Enquetes e votação por unidade')
    .addTag('occurrences', 'Ocorrências dos moradores')
    .addTag('bulletin', 'Mural de recados')
    .addTag('documents', 'Documentos com URL assinada')
    .addTag('dashboard', 'Indicadores financeiros agregados')
    .addTag('notifications', 'Notificações in-app do usuário')
    .build();

  const document = SwaggerModule.createDocument(app, swagger, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
    extraModels: [ErrorResponseDto],
  });
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/openapi.json',
    yamlDocumentUrl: 'api/openapi.yaml',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  const url = await app.getUrl();
  Logger.log(`CondoSync API ouvindo em ${url}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`Swagger em ${url}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // Se o bootstrap falha o processo deve morrer — orchestrator (Docker)
  // se encarrega de reiniciar.
  // eslint-disable-next-line no-console
  console.error('Falha no bootstrap:', err);
  process.exit(1);
});
