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

  @Get()
  findAll() {
    return this.appointmentService.findAll();
  }
  
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
  @Get(':id')
  findOne(@Param('id') id: string) {
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
  remove(@Param('id') id: string) {
    return this.appointmentService.remove(+id);
  }
}