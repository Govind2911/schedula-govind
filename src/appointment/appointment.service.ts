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

  // ==========================================
  // STREAM SLOT GENERATION
  // ==========================================
  private generateStreamSlots(
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
    const slots: { startTime: string; endTime: string }[] = [];

    let cursor = start;
    while (cursor + duration <= end) {
      slots.push({
        startTime: this.minutesToTime(cursor),
        endTime: this.minutesToTime(cursor + duration),
      });
      cursor += step;
    }

    return slots;
  }

  // ==========================================
  // PATIENT-FACING AVAILABILITY (SLOTS / WAVE WINDOW)
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
    const isToday = !this.isDateInPast(date) && date === new Date().toISOString().slice(0, 10);

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

    // Existing bookings for this doctor/date, used to mark slots booked
    // and to compute wave counts.
    const bookedAppointments = await this.appointmentRepository.find({
      where: { doctor: { id: doctorId }, appointmentDate: date },
    });

    const sessions = sourceEntries.map((entry) => {
      if (entry.type === AvailabilityType.STREAM) {
        const rawSlots = this.generateStreamSlots(
          entry.startTime,
          entry.endTime,
          entry.duration,
          entry.bufferTime ?? 0,
        );

        const slots = rawSlots
          .filter((slot) => {
            if (!isToday) return true;
            return this.timeToMinutes(slot.startTime) > this.nowMinutes();
          })
          .map((slot) => {
            const isBooked = bookedAppointments.some(
              (appt) =>
                appt.startTime === slot.startTime &&
                appt.status === 'BOOKED',
            );

            return {
              startTime: slot.startTime,
              endTime: slot.endTime,
              status: isBooked ? 'BOOKED' : 'AVAILABLE',
            };
          });

        return {
          availabilityId: entry.id,
          schedulingType: AvailabilityType.STREAM,
          slots,
        };
      }

      // WAVE
      const bookedCount = bookedAppointments.filter(
        (appt) =>
          appt.startTime === entry.startTime &&
          appt.endTime === entry.endTime &&
          appt.status === 'BOOKED',
      ).length;

      const available = Math.max(entry.capacity - bookedCount, 0);

      return {
        availabilityId: entry.id,
        schedulingType: AvailabilityType.WAVE,
        timeWindow: `${entry.startTime} - ${entry.endTime}`,
        capacity: entry.capacity,
        booked: bookedCount,
        available,
        isFull: available === 0,
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

    // -----------------------------
    // RECURRING AVAILABILITY
    // -----------------------------
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

    // -----------------------------
    // CUSTOM AVAILABILITY
    // -----------------------------
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

    const schedulingType = recurringAvailability?.type ?? customAvailability?.type;

    if (!schedulingType) {
      throw new BadRequestException('Invalid scheduling type');
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

      const source = recurringAvailability ?? customAvailability!;

      const validSlots = this.generateStreamSlots(
        source.startTime,
        source.endTime,
        source.duration,
        source.bufferTime ?? 0,
      );

      const matchedSlot = validSlots.find(
        (slot) => slot.startTime === createAppointmentDto.startTime,
      );

      if (!matchedSlot) {
        throw new BadRequestException(
          'Invalid or unavailable time slot for this availability',
        );
      }

      if (
        createAppointmentDto.appointmentDate === new Date().toISOString().slice(0, 10) &&
        this.timeToMinutes(matchedSlot.startTime) <= this.nowMinutes()
      ) {
        throw new BadRequestException('Cannot book a past time slot');
      }

      const duplicate = await this.appointmentRepository.findOne({
        where: {
          doctor: { id: doctor.id },
          appointmentDate: createAppointmentDto.appointmentDate,
          startTime: matchedSlot.startTime,
          status: 'BOOKED',
        },
        relations: { doctor: true },
      });

      if (duplicate) {
        throw new BadRequestException('Slot already booked');
      }

      const appointment = this.appointmentRepository.create({
        doctor,
        patient,
        recurringAvailability: recurringAvailability ?? undefined,
        customAvailability: customAvailability ?? undefined,
        appointmentDate: createAppointmentDto.appointmentDate,
        schedulingType,
        startTime: matchedSlot.startTime,
        endTime: matchedSlot.endTime,
        status: 'BOOKED',
      });

      return await this.appointmentRepository.save(appointment);
    }

    // ==========================================
    // WAVE BOOKING
    // ==========================================
    const source = recurringAvailability ?? customAvailability!;

    if (
      createAppointmentDto.appointmentDate === new Date().toISOString().slice(0, 10) &&
      this.timeToMinutes(source.endTime) <= this.nowMinutes()
    ) {
      throw new BadRequestException('Cannot book a past time window');
    }

    const alreadyBookedByPatient = await this.appointmentRepository.findOne({
      where: {
        doctor: { id: doctor.id },
        patient: { id: patient.id },
        appointmentDate: createAppointmentDto.appointmentDate,
        startTime: source.startTime,
        endTime: source.endTime,
        status: 'BOOKED',
      },
      relations: { doctor: true, patient: true },
    });

    if (alreadyBookedByPatient) {
      throw new BadRequestException(
        'You have already booked a slot in this wave',
      );
    }

    const existingAppointments = await this.appointmentRepository.count({
      where: {
        doctor: { id: doctor.id },
        appointmentDate: createAppointmentDto.appointmentDate,
        startTime: source.startTime,
        endTime: source.endTime,
        status: 'BOOKED',
      },
      relations: { doctor: true },
    });

    const capacity = source.capacity;

    if (!capacity || capacity < 1) {
      throw new BadRequestException('Invalid capacity configuration');
    }

    if (existingAppointments >= capacity) {
      throw new BadRequestException('Wave is full');
    }

    const appointment = this.appointmentRepository.create({
      doctor,
      patient,
      recurringAvailability: recurringAvailability ?? undefined,
      customAvailability: customAvailability ?? undefined,
      appointmentDate: createAppointmentDto.appointmentDate,
      schedulingType,
      startTime: source.startTime,
      endTime: source.endTime,
      tokenNumber: existingAppointments + 1,
      status: 'BOOKED',
    });

    return await this.appointmentRepository.save(appointment);
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
}