import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Appointment } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

import { DoctorProfile } from '../doctor/doctor-profile.entity';
import { PatientProfile } from '../patient/patient-profile.entity';
import { RecurringAvailability } from '../doctor/recurring-availability.entity';
import { CustomAvailability } from '../doctor/custom-availability.entity';
import { AvailabilityType } from '../doctor/enums/availability-type.enum';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(DoctorProfile)
    private readonly doctorRepository: Repository<DoctorProfile>,

    @InjectRepository(PatientProfile)
    private readonly patientRepository: Repository<PatientProfile>,

    @InjectRepository(RecurringAvailability)
    private readonly recurringRepository: Repository<RecurringAvailability>,

    @InjectRepository(CustomAvailability)
    private readonly customRepository: Repository<CustomAvailability>,
  ) {}

  private getDayOfWeek(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
    });
  }

  async create(
  userId: number,
  createAppointmentDto: CreateAppointmentDto,
) {
  const patient = await this.patientRepository.findOne({
    where: {
      user: {
        id: userId,
      },
    },
    relations: {
      user: true,
    },
  });

  if (!patient) {
    throw new NotFoundException('Patient profile not found');
  }

  const doctor = await this.doctorRepository.findOne({
    where: {
      id: createAppointmentDto.doctorId,
    },
  });

  if (!doctor) {
    throw new NotFoundException('Doctor not found');
  }

  let recurringAvailability: RecurringAvailability | null = null;
  let customAvailability: CustomAvailability | null = null;

  // -----------------------------
  // RECURRING AVAILABILITY
  // -----------------------------
  if (createAppointmentDto.recurringAvailabilityId) {
    recurringAvailability = await this.recurringRepository.findOne({
      where: {
        id: createAppointmentDto.recurringAvailabilityId,
      },
      relations: {
        doctorProfile: true,
      },
    });

    if (!recurringAvailability) {
      throw new NotFoundException('Recurring availability not found');
    }

    if (recurringAvailability.doctorProfile.id !== doctor.id) {
      throw new BadRequestException(
        'Availability does not belong to this doctor',
      );
    }
  }

  // -----------------------------
  // CUSTOM AVAILABILITY
  // -----------------------------
  if (createAppointmentDto.customAvailabilityId) {
    customAvailability = await this.customRepository.findOne({
      where: {
        id: createAppointmentDto.customAvailabilityId,
      },
      relations: {
        doctorProfile: true,
      },
    });

    if (!customAvailability) {
      throw new NotFoundException('Custom availability not found');
    }

    if (customAvailability.doctorProfile.id !== doctor.id) {
      throw new BadRequestException(
        'Availability does not belong to this doctor',
      );
    }
  }

  const schedulingType =
    recurringAvailability?.type ??
    customAvailability?.type;

  if (!schedulingType) {
    throw new BadRequestException(
      'Scheduling type not found',
    );
  }

  // ==========================================
  // STREAM BOOKING
  // ==========================================
  if (schedulingType === AvailabilityType.STREAM) {
  if (!createAppointmentDto.startTime) {
    throw new BadRequestException(
      'Start time is required for stream booking',
    );
  }

  const duplicate = await this.appointmentRepository.findOne({
    where: {
      doctor: {
        id: doctor.id,
      },
      appointmentDate:
        createAppointmentDto.appointmentDate,
      startTime: createAppointmentDto.startTime,
    },
    relations: {
      doctor: true,
    },
  });

  if (duplicate) {
    throw new BadRequestException(
      'Slot already booked',
    );
  }

  const duration =
    recurringAvailability?.duration ??
    customAvailability!.duration;

  const [hour, minute] =
    createAppointmentDto.startTime
      .split(':')
      .map(Number);

  const slotEnd = new Date();
  slotEnd.setHours(hour, minute + duration, 0, 0);

  const streamEndTime =
    slotEnd.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

  const appointment = this.appointmentRepository.create({
    doctor,
    patient,
    recurringAvailability:
      recurringAvailability ?? undefined,
    customAvailability:
      customAvailability ?? undefined,
    appointmentDate:
      createAppointmentDto.appointmentDate,
    schedulingType,
    startTime:
      createAppointmentDto.startTime,
    endTime: streamEndTime,

    status: 'BOOKED',
  });

  return await this.appointmentRepository.save(
    appointment,
  );
}

  // ==========================================
  // WAVE BOOKING
  // ==========================================
  const existingAppointments =
    await this.appointmentRepository.count({
      where: {
        doctor: {
          id: doctor.id,
        },
        appointmentDate:
          createAppointmentDto.appointmentDate,
      },
      relations: {
        doctor: true,
      },
    });

  const capacity =
    recurringAvailability?.capacity ??
    customAvailability!.capacity;

  if (existingAppointments >= capacity) {
    throw new BadRequestException(
      'Wave is full',
    );
  }

  const appointment = this.appointmentRepository.create({
    doctor,
    patient,
    recurringAvailability:
      recurringAvailability ?? undefined,
    customAvailability:
      customAvailability ?? undefined,
    appointmentDate:
      createAppointmentDto.appointmentDate,
    schedulingType,
    startTime:
      recurringAvailability?.startTime ??
      customAvailability!.startTime,
    endTime:
      recurringAvailability?.endTime ??
      customAvailability!.endTime,
    tokenNumber:
      existingAppointments + 1,
    status: 'BOOKED',
  });

  return await this.appointmentRepository.save(
    appointment,
  );
}



  async getDoctorAvailability(
  doctorId: number,
  date: string,
) {
  const doctor = await this.doctorRepository.findOne({
    where: { id: doctorId },
  });

  if (!doctor) {
    throw new NotFoundException('Doctor not found');
  }

  const dayOfWeek = this.getDayOfWeek(date);

  const recurring = await this.recurringRepository.find({
    where: {
      doctorProfile: {
        id: doctorId,
      },
      dayOfWeek,
    },
    relations: {
      doctorProfile: true,
    },
  });

  const custom = await this.customRepository.find({
    where: {
      doctorProfile: {
        id: doctorId,
      },
      date,
    },
    relations: {
      doctorProfile: true,
    },
  });

  return {
    doctorId,
    date,
    recurring,
    custom,
  };
} 

  async findAll() {
    return await this.appointmentRepository.find({
      relations: {
        doctor: true,
        patient: true,
        recurringAvailability: true,
        customAvailability: true,
      },
    });
  }

  async findOne(id: number) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: {
        doctor: true,
        patient: true,
        recurringAvailability: true,
        customAvailability: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(
    id: number,
    updateAppointmentDto: UpdateAppointmentDto,
  ) {
    await this.findOne(id);

    await this.appointmentRepository.update(
      id,
      updateAppointmentDto,
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    const appointment = await this.findOne(id);

    await this.appointmentRepository.remove(appointment);

    return {
      message: 'Appointment deleted successfully',
    };
  }
}