import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Role } from '../users/user.entity';

@Controller('patient')
export class PatientController {
  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  getProfile() {
    return {
      message: 'Welcome Patient',
    };
  }
}