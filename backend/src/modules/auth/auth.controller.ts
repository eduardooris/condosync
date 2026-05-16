import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, MeResponseDto } from './dto/auth-response.dto';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  RegisterDto,
  RegisterResponseDto,
} from './dto/register.dto';
import { ResetPasswordDto } from './dto/password-reset.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { OkResponseDto } from '../../common/dto/common-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ auth: { limit: 8, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Autentica usuário e retorna tokens' })
  @ApiOkResponse({
    description: 'Login efetuado com sucesso.',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas.' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cria nova conta de síndico/usuário' })
  @ApiOkResponse({
    description: 'Conta criada com sucesso.',
    type: RegisterResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'E-mail já cadastrado ou inválido.' })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ auth: { limit: 6, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Renova sessão usando refresh token' })
  @ApiOkResponse({
    description: 'Sessão renovada com sucesso.',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token inválido/expirado.' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post(['forgot-password', 'forgot'])
  @ApiOperation({
    summary: 'Solicita link de redefinição de senha',
    description:
      'Recebe o e-mail da conta e envia o link por WhatsApp: usa o número cadastrado no perfil da conta, se houver; senão o do morador vinculado.',
  })
  @ApiOkResponse({
    description:
      'Solicitação registrada. Se o e-mail existir e houver WhatsApp cadastrado, uma mensagem será enviada em instantes.',
    type: OkResponseDto,
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<OkResponseDto> {
    await this.authService.forgotPassword(dto.email);
    return { ok: true };
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @ApiOperation({
    summary: 'Define nova senha usando o token recebido no WhatsApp',
  })
  @ApiOkResponse({ description: 'Senha atualizada.', type: OkResponseDto })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<OkResponseDto> {
    await this.authService.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('logout')
  @ApiOperation({ summary: 'Encerra sessão do token informado' })
  @ApiOkResponse({ description: 'Logout processado.', type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Bearer token ausente/inválido.' })
  async logout(
    @Headers('authorization') authorization?: string,
  ): Promise<OkResponseDto> {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;
    if (!token) {
      throw new UnauthorizedException('Token Bearer obrigatório.');
    }
    await this.authService.logout(token);
    return { ok: true };
  }

  @ApiBearerAuth('bearer')
  @Get('me')
  @ApiOperation({ summary: 'Retorna perfil do usuário autenticado' })
  @ApiOkResponse({
    description: 'Perfil retornado com sucesso.',
    type: MeResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido/expirado.' })
  async me(@CurrentUser() user: RequestUser): Promise<MeResponseDto> {
    const profile = await this.authService.me(user.id, user.email);
    if (!profile) {
      throw new UnauthorizedException();
    }
    return profile as MeResponseDto;
  }

  @ApiBearerAuth('bearer')
  @Patch('me')
  @ApiOperation({
    summary: 'Atualiza nome e WhatsApp da conta',
    description:
      'O WhatsApp cadastrado aqui é usado no fluxo “esqueci minha senha” com prioridade sobre o número do morador vinculado.',
  })
  @ApiOkResponse({
    description: 'Perfil atualizado.',
    type: MeResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido/expirado.' })
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMeDto,
  ): Promise<MeResponseDto> {
    const profile = await this.authService.updateMyProfile(user.id, dto);
    return profile as MeResponseDto;
  }
}
