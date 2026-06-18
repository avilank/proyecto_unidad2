import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { UserContext } from '../common/decorators/user-context.decorator';
import { AuthService, AuthUserPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Usuario autenticado' })
  me(@UserContext() user: AuthUserPayload) {
    return this.authService.me(user);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión' })
  logout() {
    return this.authService.logout();
  }
}
