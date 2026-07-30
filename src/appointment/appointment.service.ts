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
import { AppointmentStatus } from './enums/appointment-status.enum';

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
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
    });
  }

  private timeToMinutes(time: string): number {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  }

  private minutesToTime(totalMinutes: number): string {
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private isDateInPast(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${date}T00:00:00`);
    return target < today;
  }

  private nowMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private generateWindows(
    startTime: string,
    endTime: string,
    duration: number,
    bufferTime: number,
  ): { startTime: string; endTime: string }[] {
    if (!duration || duration <= 0) {
      throw new BadRequestException('Invalid slot duration');
    }

    if (bufferTime < 0) {
      throw new BadRequestException('Invalid buffer time');
    }

    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    if (start >= end) {
      throw new BadRequestException(
        'Invalid availability window: start time must be before end time',
      );
    }

    const step = duration + (bufferTime ?? 0);
    const windows: { startTime: string; endTime: string }[] = [];

    let cursor = start;
    while (cursor + duration <= end) {
      windows.push({
        startTime: this.minutesToTime(cursor),
        endTime: this.minutesToTime(cursor + duration),
      });
      cursor += step;
    }

    return windows;
  }

  // ==========================================
  // PATIENT-FACING AVAILABILITY
  // ==========================================
  async getPatientAvailability(doctorId: number, date: string) {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      throw new BadRequestException('Invalid date');
    }

    const dayOfWeek = this.getDayOfWeek(date);
    const isToday = !this.isDateInPast(date) && date === this.todayIso();

    // Custom (date-specific) availability overrides recurring availability.
    const customEntries = await this.customRepository.find({
      where: { doctorProfile: { id: doctorId }, date },
      relations: { doctorProfile: true },
    });

    const sourceEntries: Array<RecurringAvailability | CustomAvailability> =
      customEntries.length > 0
        ? customEntries
        : await this.recurringRepository.find({
            where: { doctorProfile: { id: doctorId }, dayOfWeek },
            relations: { doctorProfile: true },
          });

    if (sourceEntries.length === 0) {
      return {
        doctorId,
        date,
        sessions: [],
        message: 'No availability configured for this date',
      };
    }

    const bookedAppointments = await this.appointmentRepository.find({
      where: { doctor: { id: doctorId }, appointmentDate: date },
    });

    const sessions = sourceEntries.map((entry) => {
      const rawWindows = this.generateWindows(
        entry.startTime,
        entry.endTime,
        entry.duration,
        entry.bufferTime ?? 0,
      );

      const futureWindows = rawWindows.filter((w) => {
        if (!isToday) return true;
        return this.timeToMinutes(w.startTime) > this.nowMinutes();
      });

      // STREAM and WAVE both generate one-patient-per-slot windows. The
      // per-patient slot length (entry.duration) is derived at
      // availability-creation time by splitting the whole session evenly
      // across `capacity`, accounting for `bufferTime` between
      // consecutive patients - that's true for both types, so the same
      // window generation and slot mapping applies to both.
      const slots = futureWindows.map((slot) => {
        const isBooked = bookedAppointments.some(
          (appt) =>
       appt.startTime.substring(0, 5) === slot.startTime &&
    appt.endTime.substring(0, 5) === slot.endTime &&
    appt.status === AppointmentStatus.BOOKED,
);

        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: isBooked ? AppointmentStatus.BOOKED : AppointmentStatus.AVAILABLE,
        };
      });

      return {
        availabilityId: entry.id,
        schedulingType: entry.type,
        capacity: entry.capacity,
        slotDurationMinutes: entry.duration,
        bufferTime: entry.bufferTime ?? 0,
        slots,
      };
    });

    return {
      doctorId,
      date,
      sessions,
    };
  }

  async create(userId: number, createAppointmentDto: CreateAppointmentDto) {
    const patient = await this.patientRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    const doctor = await this.doctorRepository.findOne({
      where: { id: createAppointmentDto.doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (
      !createAppointmentDto.recurringAvailabilityId &&
      !createAppointmentDto.customAvailabilityId
    ) {
      throw new BadRequestException(
        'An availability reference (recurringAvailabilityId or customAvailabilityId) is required',
      );
    }

    if (
      createAppointmentDto.recurringAvailabilityId &&
      createAppointmentDto.customAvailabilityId
    ) {
      throw new BadRequestException(
        'Provide only one availability reference, not both',
      );
    }

    if (
      !createAppointmentDto.appointmentDate ||
      Number.isNaN(
        new Date(`${createAppointmentDto.appointmentDate}T00:00:00`).getTime(),
      )
    ) {
      throw new BadRequestException('Invalid appointment date');
    }

    if (this.isDateInPast(createAppointmentDto.appointmentDate)) {
      throw new BadRequestException(
        'Cannot book an appointment in the past',
      );
    }

    let recurringAvailability: RecurringAvailability | null = null;
    let customAvailability: CustomAvailability | null = null;

    if (createAppointmentDto.recurringAvailabilityId) {
      recurringAvailability = await this.recurringRepository.findOne({
        where: { id: createAppointmentDto.recurringAvailabilityId },
        relations: { doctorProfile: true },
      });

      if (!recurringAvailability) {
        throw new NotFoundException('Recurring availability not found');
      }

      if (recurringAvailability.doctorProfile.id !== doctor.id) {
        throw new BadRequestException(
          'Availability does not belong to this doctor',
        );
      }

      const expectedDayOfWeek = this.getDayOfWeek(
        createAppointmentDto.appointmentDate,
      );

      if (recurringAvailability.dayOfWeek !== expectedDayOfWeek) {
        throw new BadRequestException(
          'Conflicting schedule: this availability does not apply to the selected date',
        );
      }
    }

    if (createAppointmentDto.customAvailabilityId) {
      customAvailability = await this.customRepository.findOne({
        where: { id: createAppointmentDto.customAvailabilityId },
        relations: { doctorProfile: true },
      });

      if (!customAvailability) {
        throw new NotFoundException('Custom availability not found');
      }

      if (customAvailability.doctorProfile.id !== doctor.id) {
        throw new BadRequestException(
          'Availability does not belong to this doctor',
        );
      }

      if (customAvailability.date !== createAppointmentDto.appointmentDate) {
        throw new BadRequestException(
          'Conflicting schedule: this availability does not apply to the selected date',
        );
      }
    }

    const source = recurringAvailability ?? customAvailability!;
    const schedulingType = source.type;

    if (!schedulingType) {
      throw new BadRequestException('Invalid scheduling type');
    }

    if (!createAppointmentDto.startTime) {
      throw new BadRequestException(
        'Start time is required (pick one of the generated slots/waves for this availability)',
      );
    }

    // STREAM and WAVE both generate discrete one-patient-per-slot windows
    // from the same availability row. For WAVE, `source.duration` is the
    // per-patient duration already derived (at availability-creation
    // time) from splitting the whole session evenly across `capacity`,
    // accounting for `bufferTime` between consecutive patients - so the
    // same window generation applies to both types.
    const windows = this.generateWindows(
      source.startTime,
      source.endTime,
      source.duration,
      source.bufferTime ?? 0,
    );

    const slotIndex = windows.findIndex(
      (w) => w.startTime === createAppointmentDto.startTime,
    );
    const matchedWindow = slotIndex === -1 ? undefined : windows[slotIndex];

    if (!matchedWindow) {
      throw new BadRequestException(
        'Invalid or unavailable time slot for this availability',
      );
    }

    if (
      createAppointmentDto.appointmentDate === this.todayIso() &&
      this.timeToMinutes(matchedWindow.startTime) <= this.nowMinutes()
    ) {
      throw new BadRequestException('Cannot book a past time slot');
    }

    // ==========================================
    // BOOKING - exactly one patient per generated slot, for both STREAM
    // and WAVE. Also enforced at the DB level by the unique constraint
    // on (doctor, appointmentDate, startTime, endTime).
    // ==========================================
    const duplicate = await this.appointmentRepository.findOne({
      where: {
        doctor: { id: doctor.id },
        appointmentDate: createAppointmentDto.appointmentDate,
        startTime: matchedWindow.startTime,
        status: AppointmentStatus.BOOKED,
      },
      relations: { doctor: true },
    });

    if (duplicate) {
      throw new BadRequestException(
        schedulingType === AvailabilityType.WAVE
          ? 'This slot has already been booked'
          : 'Slot already booked',
      );
    }

    const appointment = this.appointmentRepository.create({
      doctor,
      patient,
      recurringAvailability: recurringAvailability ?? undefined,
      customAvailability: customAvailability ?? undefined,
      appointmentDate: createAppointmentDto.appointmentDate,
      schedulingType,
      startTime: matchedWindow.startTime,
      endTime: matchedWindow.endTime,
      tokenNumber: slotIndex + 1,
      status: AppointmentStatus.BOOKED,
    });

    const saved = await this.appointmentRepository.save(appointment);

    return {
      message: 'Appointment booked successfully',
      appointment: saved,
    };
  }

  async getDoctorAvailability(doctorId: number, date: string) {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const dayOfWeek = this.getDayOfWeek(date);

    const recurring = await this.recurringRepository.find({
      where: { doctorProfile: { id: doctorId }, dayOfWeek },
      relations: { doctorProfile: true },
    });

    const custom = await this.customRepository.find({
      where: { doctorProfile: { id: doctorId }, date },
      relations: { doctorProfile: true },
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

  async update(id: number, updateAppointmentDto: UpdateAppointmentDto) {
    await this.findOne(id);

    await this.appointmentRepository.update(id, updateAppointmentDto);

    return this.findOne(id);
  }

  async remove(id: number) {
    const appointment = await this.findOne(id);

    await this.appointmentRepository.remove(appointment);

    return {
      message: 'Appointment deleted successfully',
    };
  }
  async getMyAppointments(userId: number) {
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
    throw new NotFoundException(
      'Patient profile not found',
    );
  }

  const appointments =
    await this.appointmentRepository.find({
      where: {
        patient: {
          id: patient.id,
        },
      },
      relations: {
        doctor: true,
      },
      order: {
        appointmentDate: 'ASC',
      },
    });

  if (!appointments.length) {
    throw new NotFoundException(
      'No appointments found',
    );
  }

  return appointments;
}

async cancelAppointment(
  appointmentId: number,
  userId: number,
) {
  const patient = await this.patientRepository.findOne({
    where: {
      user: {
        id: userId,
      },
    },
  });

  if (!patient) {
    throw new NotFoundException(
      'Patient profile not found',
    );
  }

  const appointment =
    await this.appointmentRepository.findOne({
      where: {
        id: appointmentId,
      },
      relations: {
        patient: true,
      },
    });

  if (!appointment) {
    throw new NotFoundException(
      'Appointment not found',
    );
  }

  if (
    appointment.patient.id !== patient.id
  ) {
    throw new BadRequestException(
      'Unauthorized access',
    );
  }

  if (
    appointment.status ===
    AppointmentStatus.CANCELLED
  ) {
    throw new BadRequestException(
      'Appointment already cancelled',
    );
  }

  if (
    this.isDateInPast(
      appointment.appointmentDate,
    )
  ) {
    throw new BadRequestException(
      'Past appointment cannot be cancelled',
    );
  }

  appointment.status =
    AppointmentStatus.CANCELLED;

  return await this.appointmentRepository.save(
    appointment,
  );
}

}