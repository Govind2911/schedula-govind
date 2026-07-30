import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Role } from '../users/user.entity';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentController {
  constructor(
    private readonly appointmentService: AppointmentService,
  ) {}

  // -----------------------------
  // BOOK APPOINTMENT
  // -----------------------------
  @Post()
  @Roles(Role.PATIENT)
  create(
    @Req() req,
    @Body() createAppointmentDto: CreateAppointmentDto,
  ) {
    return this.appointmentService.create(
      req.user.userId,
      createAppointmentDto,
    );
  }

  // -----------------------------
  // PATIENT APPOINTMENTS
  // -----------------------------
  @Get('my')
  @Roles(Role.PATIENT)
  getMyAppointments(@Req() req) {
    return this.appointmentService.getMyAppointments(
      req.user.userId,
    );
  }

  // -----------------------------
  // CANCEL APPOINTMENT
  // -----------------------------
  @Patch(':id/cancel')
  @Roles(Role.PATIENT)
  cancelAppointment(
    @Req() req,
    @Param('id') id: string,
  ) {
    return this.appointmentService.cancelAppointment(
      +id,
      req.user.userId,
    );
  }

  // -----------------------------
  // ADMIN / DEBUG
  // -----------------------------
  @Get()
  findAll() {
    return this.appointmentService.findAll();
  }

  // -----------------------------
  // SLOT APIs
  // -----------------------------
  @Get('availability/:doctorId/:date')
  getAvailability(
    @Param('doctorId') doctorId: string,
    @Param('date') date: string,
  ) {
    return this.appointmentService.getDoctorAvailability(
      +doctorId,
      date,
    );
  }

  @Get('slots/:doctorId/:date')
  getSlots(
    @Param('doctorId') doctorId: string,
    @Param('date') date: string,
  ) {
    return this.appointmentService.getPatientAvailability(
      +doctorId,
      date,
    );
  }

  // -----------------------------
  // EXISTING CRUD
  // -----------------------------
  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.appointmentService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(
      +id,
      updateAppointmentDto,
    );
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
  ) {
    return this.appointmentService.remove(+id);
  }
}