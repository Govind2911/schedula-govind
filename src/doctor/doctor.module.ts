import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';
import { DoctorProfile } from './doctor-profile.entity';
import { User } from '../users/user.entity';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { Appointment } from 'src/appointment/entities/appointment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorProfile,
      User,
      RecurringAvailability,
      CustomAvailability,
      Appointment,
    ]),
  ],
  controllers: [DoctorController],
  providers: [DoctorService],
})
export class DoctorModule {}