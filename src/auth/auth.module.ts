import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './jwt.strategy/jwt.strategy';
import { Roles } from './roles/roles.decorator';
import { RolesGuard } from './roles/roles.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      secret: 'schedula-secret-key',
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
})
export class AuthModule {}
