import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { RecurringAvailability} from './doctor/recurring-availability.entity';
import { CustomAvailability } from './doctor/custom-availability.entity';
import { AppointmentModule } from './appointment/appointment.module';
@Module({
  imports: [
 TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'root123',
      database: 'schedula',

      autoLoadEntities: true,
      synchronize: false,
    }),
 UsersModule,
 AuthModule,
 DoctorModule,
 PatientModule,
 RecurringAvailability, 
 CustomAvailability, AppointmentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
