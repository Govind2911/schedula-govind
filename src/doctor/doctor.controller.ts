import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { DoctorService } from './doctor.service';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';

import { Role } from '../users/user.entity';

import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';

@Controller('doctor')
export class DoctorController {
  constructor(
    private readonly doctorService: DoctorService,
  ) {}

 
 @Post('profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
createProfile(
  @Req() req,
  @Body() dto: CreateDoctorProfileDto,
) {
  return this.doctorService.createProfile(
    req.user.userId,
    dto,
  );
}
@Get('profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
getProfile(@Req() req) {
  return this.doctorService.getProfile(
    req.user.userId,
  );
}
@Patch('profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
updateProfile(
  @Req() req,
  @Body() dto: UpdateDoctorProfileDto,
) {
  return this.doctorService.updateProfile(
    req.user.userId,
    dto,
  );
}
}