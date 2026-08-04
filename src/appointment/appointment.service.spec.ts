import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AppointmentService } from './appointment.service';
import { Appointment } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/doctor-profile.entity';
import { PatientProfile } from '../patient/patient-profile.entity';
import { RecurringAvailability } from '../doctor/recurring-availability.entity';
import { CustomAvailability } from '../doctor/custom-availability.entity';
import { AvailabilityType } from '../doctor/enums/availability-type.enum';
import { AppointmentStatus } from './enums/appointment-status.enum';

// Far-future date so "is this in the past?" checks never trigger flakiness.
const FUTURE_DATE = '2099-06-15';
const FUTURE_DAY_OF_WEEK = new Date(`${FUTURE_DATE}T00:00:00`).toLocaleDateString(
  'en-US',
  { weekday: 'long' },
);

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
});

// Mock query runner used by rescheduleAppointment's transaction. Each
// test wires manager.findOne to whatever it needs (patient/appointment
// lookups and the conflict check all go through this one mock).
const mockManager = () => ({
  findOne: jest.fn(),
  save: jest.fn((x) => Promise.resolve(x)),
});

const mockQueryRunner = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: mockManager(),
});

describe('AppointmentService', () => {
  let service: AppointmentService;
  let appointmentRepository: ReturnType<typeof mockRepo>;
  let doctorRepository: ReturnType<typeof mockRepo>;
  let patientRepository: ReturnType<typeof mockRepo>;
  let recurringRepository: ReturnType<typeof mockRepo>;
  let customRepository: ReturnType<typeof mockRepo>;
  let queryRunner: ReturnType<typeof mockQueryRunner>;

  const doctor: Partial<DoctorProfile> = { id: 1, fullName: 'Dr. Rao' } as any;
  const patient: Partial<PatientProfile> = { id: 1, fullName: 'John' } as any;

  beforeEach(async () => {
    queryRunner = mockQueryRunner();
    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment), useFactory: mockRepo },
        { provide: getRepositoryToken(DoctorProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(PatientProfile), useFactory: mockRepo },
        {
          provide: getRepositoryToken(RecurringAvailability),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(CustomAvailability),
          useFactory: mockRepo,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    appointmentRepository = module.get(getRepositoryToken(Appointment));
    doctorRepository = module.get(getRepositoryToken(DoctorProfile));
    patientRepository = module.get(getRepositoryToken(PatientProfile));
    recurringRepository = module.get(getRepositoryToken(RecurringAvailability));
    customRepository = module.get(getRepositoryToken(CustomAvailability));

    patientRepository.findOne.mockResolvedValue(patient);
    doctorRepository.findOne.mockResolvedValue(doctor);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================
  // STREAM SCHEDULING
  // 10:00-12:00 window, capacity 6 -> 20 min per patient (derived),
  // matching the "big window split evenly across capacity" model.
  // ==========================================
  describe('Stream scheduling', () => {
    const streamAvailability = {
      id: 10,
      type: AvailabilityType.STREAM,
      dayOfWeek: FUTURE_DAY_OF_WEEK,
      startTime: '10:00',
      endTime: '12:00',
      duration: 20, // derived by doctor.service at creation time
      bufferTime: 0,
      capacity: 6,
      doctorProfile: doctor,
    };

    it('books the exact requested slot when it is free', async () => {
      recurringRepository.findOne.mockResolvedValue(streamAvailability);
      appointmentRepository.findOne.mockResolvedValue(null); // no duplicate

      const result = await service.create(1, {
        doctorId: 1,
        appointmentDate: FUTURE_DATE,
        recurringAvailabilityId: 10,
        startTime: '10:40',
      });

      expect(result.appointment.startTime).toBe('10:40');
      expect(result.appointment.endTime).toBe('11:00');
      expect(result.appointment.schedulingType).toBe(AvailabilityType.STREAM);
    });

    it('rejects a start time that does not align with the generated grid', async () => {
      recurringRepository.findOne.mockResolvedValue(streamAvailability);

      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 10,
          startTime: '10:07',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects booking when the slot is already taken', async () => {
      recurringRepository.findOne.mockResolvedValue(streamAvailability);
      appointmentRepository.findOne.mockResolvedValue({ id: 99 }); // duplicate found

      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 10,
          startTime: '10:00',
        }),
      ).rejects.toThrow('Slot already booked');
    });

    it('requires a start time for booking', async () => {
      recurringRepository.findOne.mockResolvedValue(streamAvailability);

      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 10,
        }),
      ).rejects.toThrow('Start time is required');
    });

    it('generates 6 equal 20-min exact slots across the 2-hour window for the patient view', async () => {
      customRepository.find.mockResolvedValue([]);
      recurringRepository.find.mockResolvedValue([streamAvailability]);
      appointmentRepository.find.mockResolvedValue([]);

      const result = await service.getPatientAvailability(1, FUTURE_DATE);

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].schedulingType).toBe(AvailabilityType.STREAM);
      expect(result.sessions[0].slots).toHaveLength(6);
      expect(result.sessions[0]!.slots![0]).toEqual({
        startTime: '10:00',
        endTime: '10:20',
        status: 'AVAILABLE',
      });
      expect(result.sessions[0]!.slots![5]).toEqual({
        startTime: '11:40',
        endTime: '12:00',
        status: 'AVAILABLE',
      });
    });
  });

  // ==========================================
  // WAVE SCHEDULING
  // 10:00-12:00 window, capacity 4, buffer 5 -> duration is derived at
  // availability-creation time (by doctor.service) the same way STREAM's
  // is: (120 - 3*5) / 4 = 26.25 -> floored to 26. Each generated slot
  // belongs to exactly one patient, same as STREAM.
  // ==========================================
  describe('Wave scheduling', () => {
    const waveAvailability = {
      id: 20,
      type: AvailabilityType.WAVE,
      dayOfWeek: FUTURE_DAY_OF_WEEK,
      startTime: '10:00',
      endTime: '12:00',
      duration: 26, // derived by doctor.service at creation time
      bufferTime: 5,
      capacity: 4,
      doctorProfile: doctor,
    };

    it('generates four one-patient slots split evenly across the session', async () => {
      customRepository.find.mockResolvedValue([]);
      recurringRepository.find.mockResolvedValue([waveAvailability]);
      appointmentRepository.find.mockResolvedValue([
        { startTime: '10:00', endTime: '10:26', status: 'BOOKED' },
      ]);

      const result = await service.getPatientAvailability(1, FUTURE_DATE);

      expect(result.sessions[0].schedulingType).toBe(AvailabilityType.WAVE);
      expect(result.sessions[0].slots).toHaveLength(4);
      expect(result.sessions[0]!.slots![0]).toEqual({
        startTime: '10:00',
        endTime: '10:26',
        status: 'BOOKED',
      });
      expect(result.sessions[0]!.slots![1]).toEqual({
        startTime: '10:31',
        endTime: '10:57',
        status: 'AVAILABLE',
      });
      expect(result.sessions[0]!.slots![2]).toEqual({
        startTime: '11:02',
        endTime: '11:28',
        status: 'AVAILABLE',
      });
      expect(result.sessions[0]!.slots![3]).toEqual({
        startTime: '11:33',
        endTime: '11:59',
        status: 'AVAILABLE',
      });
    });

    it('books the exact requested slot when it is free', async () => {
      recurringRepository.findOne.mockResolvedValue(waveAvailability);
      appointmentRepository.findOne.mockResolvedValue(null); // no duplicate

      const result = await service.create(1, {
        doctorId: 1,
        appointmentDate: FUTURE_DATE,
        recurringAvailabilityId: 20,
        startTime: '10:31',
      });

      expect(result.appointment.tokenNumber).toBe(2);
      expect(result.appointment.startTime).toBe('10:31');
      expect(result.appointment.endTime).toBe('10:57');
      expect(result.appointment.schedulingType).toBe(AvailabilityType.WAVE);
    });

    it('rejects booking once that specific slot is already taken', async () => {
      recurringRepository.findOne.mockResolvedValue(waveAvailability);
      appointmentRepository.findOne.mockResolvedValue({ id: 55 }); // duplicate found

      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 20,
          startTime: '10:00',
        }),
      ).rejects.toThrow('This slot has already been booked');
    });

    it('rejects a start time that does not match any generated slot', async () => {
      recurringRepository.findOne.mockResolvedValue(waveAvailability);

      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 20,
          startTime: '10:15',
        }),
      ).rejects.toThrow('Invalid or unavailable time slot for this availability');
    });
  });

  // ==========================================
  // GENERAL EDGE CASES
  // ==========================================
  describe('General edge cases', () => {
    it('throws NotFoundException when the doctor does not exist', async () => {
      doctorRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(1, {
          doctorId: 999,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when no availability reference is provided', async () => {
      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
        }),
      ).rejects.toThrow(
        'An availability reference (recurringAvailabilityId or customAvailabilityId) is required',
      );
    });

    it('rejects when both availability references are provided', async () => {
      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 10,
          customAvailabilityId: 20,
        }),
      ).rejects.toThrow('Provide only one availability reference, not both');
    });

    it('rejects booking an appointment in the past', async () => {
      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: '2000-01-01',
          recurringAvailabilityId: 10,
        }),
      ).rejects.toThrow('Cannot book an appointment in the past');
    });

    it('rejects an invalid appointment date', async () => {
      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: 'not-a-date',
          recurringAvailabilityId: 10,
        }),
      ).rejects.toThrow('Invalid appointment date');
    });

    it('rejects when availability does not belong to the doctor', async () => {
      recurringRepository.findOne.mockResolvedValue({
        id: 10,
        type: AvailabilityType.STREAM,
        dayOfWeek: FUTURE_DAY_OF_WEEK,
        startTime: '10:00',
        endTime: '12:00',
        duration: 20,
        bufferTime: 0,
        capacity: 6,
        doctorProfile: { id: 999 },
      });

      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 10,
          startTime: '10:00',
        }),
      ).rejects.toThrow('Availability does not belong to this doctor');
    });

    it('returns an empty session list when no availability is configured', async () => {
      customRepository.find.mockResolvedValue([]);
      recurringRepository.find.mockResolvedValue([]);

      const result = await service.getPatientAvailability(1, FUTURE_DATE);

      expect(result.sessions).toEqual([]);
      expect(result.message).toBe('No availability configured for this date');
    });
  });

  // ==========================================
  // CANCEL APPOINTMENT (incl. 30-minute cutoff)
  // ==========================================
  describe('Cancel appointment', () => {
    it('cancels an appointment safely outside the cutoff window', async () => {
      const appointment = {
        id: 100,
        status: AppointmentStatus.BOOKED,
        appointmentDate: FUTURE_DATE,
        startTime: '10:00:00',
        patient: { id: 1 },
      };
      appointmentRepository.findOne.mockResolvedValue(appointment);
      appointmentRepository.save.mockImplementation((x) => Promise.resolve(x));

      const result = await service.cancelAppointment(100, 1);

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('rejects cancelling within the 30-minute cutoff', async () => {
      const soon = new Date(Date.now() + 10 * 60000);
      const soonDate = soon.toISOString().slice(0, 10);
      const soonTime = `${String(soon.getHours()).padStart(2, '0')}:${String(
        soon.getMinutes(),
      ).padStart(2, '0')}:00`;

      appointmentRepository.findOne.mockResolvedValue({
        id: 101,
        status: AppointmentStatus.BOOKED,
        appointmentDate: soonDate,
        startTime: soonTime,
        patient: { id: 1 },
      });

      await expect(service.cancelAppointment(101, 1)).rejects.toThrow(
        'at least 30 minutes',
      );
    });

    it('rejects cancelling someone else\'s appointment', async () => {
      appointmentRepository.findOne.mockResolvedValue({
        id: 102,
        status: AppointmentStatus.BOOKED,
        appointmentDate: FUTURE_DATE,
        startTime: '10:00:00',
        patient: { id: 999 },
      });

      await expect(service.cancelAppointment(102, 1)).rejects.toThrow(
        'Unauthorized access',
      );
    });

    it('rejects cancelling an already-cancelled appointment', async () => {
      appointmentRepository.findOne.mockResolvedValue({
        id: 103,
        status: AppointmentStatus.CANCELLED,
        appointmentDate: FUTURE_DATE,
        startTime: '10:00:00',
        patient: { id: 1 },
      });

      await expect(service.cancelAppointment(103, 1)).rejects.toThrow(
        'Appointment already cancelled',
      );
    });
  });

  // ==========================================
  // RESCHEDULE APPOINTMENT
  // ==========================================
  describe('Reschedule appointment', () => {
    const streamAvailability = {
      id: 10,
      type: AvailabilityType.STREAM,
      dayOfWeek: FUTURE_DAY_OF_WEEK,
      startTime: '10:00',
      endTime: '12:00',
      duration: 20,
      bufferTime: 0,
      capacity: 6,
      doctorProfile: doctor,
    };

    const waveAvailability = {
      id: 20,
      type: AvailabilityType.WAVE,
      dayOfWeek: FUTURE_DAY_OF_WEEK,
      startTime: '10:00',
      endTime: '12:00',
      duration: 26,
      bufferTime: 5,
      capacity: 4,
      doctorProfile: doctor,
    };

    const existingStreamAppointment = {
      id: 100,
      status: AppointmentStatus.BOOKED,
      appointmentDate: FUTURE_DATE,
      startTime: '10:00:00',
      endTime: '10:20:00',
      tokenNumber: 1,
      schedulingType: AvailabilityType.STREAM,
      doctor: { id: 1 },
      patient: { id: 1 },
      recurringAvailability: { id: 10 },
      customAvailability: null,
    };

    it('reschedules to a free slot on the same availability', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient) // patient lookup
        .mockResolvedValueOnce(existingStreamAppointment) // appointment lookup
        .mockResolvedValueOnce(streamAvailability) // target availability
        .mockResolvedValueOnce(null); // conflict check - free

      const result = await service.rescheduleAppointment(100, 1, {
        appointmentDate: FUTURE_DATE,
        startTime: '11:00',
      });

      expect(result.message).toBe('Appointment rescheduled successfully');
      expect(result.appointment.startTime).toBe('11:00');
      expect(result.appointment.endTime).toBe('11:20');
      expect(result.appointment.tokenNumber).toBe(4);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('prevents rescheduling to the exact same slot', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce(existingStreamAppointment)
        .mockResolvedValueOnce(streamAvailability);

      await expect(
        service.rescheduleAppointment(100, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '10:00',
        }),
      ).rejects.toThrow('New slot is the same as the current appointment');
    });

    it('rejects a start time that does not align with the generated grid', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce(existingStreamAppointment)
        .mockResolvedValueOnce(streamAvailability);

      await expect(
        service.rescheduleAppointment(100, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '10:07',
        }),
      ).rejects.toThrow('Requested slot does not exist for this availability');
    });

    it('rejects rescheduling someone else\'s appointment', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce({
          ...existingStreamAppointment,
          patient: { id: 999 },
        });

      await expect(
        service.rescheduleAppointment(100, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '11:00',
        }),
      ).rejects.toThrow('Unauthorized access');
    });

    it('rejects rescheduling a cancelled appointment', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce({
          ...existingStreamAppointment,
          status: AppointmentStatus.CANCELLED,
        });

      await expect(
        service.rescheduleAppointment(100, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '11:00',
        }),
      ).rejects.toThrow('Cannot reschedule a cancelled appointment');
    });

    it('enforces the 30-minute cutoff on the slot being given up', async () => {
      const soon = new Date(Date.now() + 10 * 60000);
      const soonDate = soon.toISOString().slice(0, 10);
      const soonTime = `${String(soon.getHours()).padStart(2, '0')}:${String(
        soon.getMinutes(),
      ).padStart(2, '0')}:00`;

      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce({
          ...existingStreamAppointment,
          appointmentDate: soonDate,
          startTime: soonTime,
        });

      await expect(
        service.rescheduleAppointment(100, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '11:00',
        }),
      ).rejects.toThrow('at least 30 minutes');
    });

    it('rejects an invalid appointment id without touching the transaction', async () => {
      await expect(
        service.rescheduleAppointment(0, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '11:00',
        }),
      ).rejects.toThrow('Invalid appointment id');

      expect(queryRunner.connect).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the appointment does not exist', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce(null);

      await expect(
        service.rescheduleAppointment(999, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '11:00',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('suggests the next available slot when the requested one is already booked', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce(existingStreamAppointment)
        .mockResolvedValueOnce(streamAvailability)
        .mockResolvedValueOnce({ id: 999 }); // conflict - already booked

      customRepository.find.mockResolvedValue([]);
      recurringRepository.find.mockResolvedValue([streamAvailability]);
      appointmentRepository.find.mockResolvedValue([
        { id: 999, startTime: '10:20', endTime: '10:40', status: 'BOOKED' },
      ]);

      try {
        await service.rescheduleAppointment(100, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '10:20',
        });
        throw new Error('expected rescheduleAppointment to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as {
          message: string;
          suggestedSlot: { startTime: string; endTime: string } | null;
        };
        expect(response.message).toBe('This slot has already been booked');
        expect(response.suggestedSlot?.startTime).toBe('10:40');
      }

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('uses "wave" wording when a WAVE availability is full', async () => {
      const existingWaveAppointment = {
        ...existingStreamAppointment,
        schedulingType: AvailabilityType.WAVE,
        recurringAvailability: { id: 20 },
      };

      queryRunner.manager.findOne
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce(existingWaveAppointment)
        .mockResolvedValueOnce(waveAvailability)
        .mockResolvedValueOnce({ id: 888 }); // conflict - wave slot full

      customRepository.find.mockResolvedValue([]);
      recurringRepository.find.mockResolvedValue([waveAvailability]);
      appointmentRepository.find.mockResolvedValue([
        { id: 888, startTime: '10:31', endTime: '10:57', status: 'BOOKED' },
      ]);

      try {
        await service.rescheduleAppointment(100, 1, {
          appointmentDate: FUTURE_DATE,
          startTime: '10:31',
        });
        throw new Error('expected rescheduleAppointment to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as {
          message: string;
        };
        expect(response.message).toBe('This wave is already full');
      }
    });
  });
});