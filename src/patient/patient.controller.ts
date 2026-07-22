import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PatientService } from './patient.service';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';

import { Role } from '../users/user.entity';

import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@Controller('patient')
export class PatientController {
  constructor(
    private readonly patientService: PatientService,
  ) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  createProfile(
    @Req() req,
    @Body() dto: CreatePatientProfileDto,
  ) {
    return this.patientService.createProfile(
      req.user.userId,
      dto,
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  getProfile(@Req() req) {
    return this.patientService.getProfile(
      req.user.userId,
    );
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  updateProfile(
    @Req() req,
    @Body() dto: UpdatePatientProfileDto,
  ) {
    return this.patientService.updateProfile(
      req.user.userId,
      dto,
    );
  }
}