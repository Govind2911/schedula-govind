import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  ParseIntPipe,
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
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';

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

  @Post('availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  createAvailability(
    @Req() req,
    @Body() dto: CreateRecurringAvailabilityDto,
  ) {
    return this.doctorService.createRecurringAvailability(
      req.user.userId,
      dto,
    );
  }

  @Get('availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  getAvailability(@Req() req) {
    return this.doctorService.getRecurringAvailability(
      req.user.userId,
    );
  }

  @Patch('availability/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  updateAvailability(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecurringAvailabilityDto,
  ) {
    return this.doctorService.updateRecurringAvailability(
      req.user.userId,
      id,
      dto,
    );
  }

  @Delete('availability/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  deleteAvailability(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.doctorService.deleteRecurringAvailability(
      req.user.userId,
      id,
    );
  }

  @Post('availability/override')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  createOverride(
    @Req() req,
    @Body() dto: CreateCustomAvailabilityDto,
  ) {
    return this.doctorService.createCustomAvailability(
      req.user.userId,
      dto,
    );
  }

  @Get('availability/date')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  getAvailabilityByDate(
    @Req() req,
    @Query('date') date: string,
  ) {
    return this.doctorService.getAvailabilityByDate(
      req.user.userId,
      date,
    );
  }

  @Get('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
getAppointments(@Req() req) {
  return this.doctorService.getAppointments(
    req.user.userId,
  );
}
}