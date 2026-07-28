import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AppointmentService } from './appointment.service';
import { Appointment } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/doctor-profile.entity';
import { PatientProfile } from '../patient/patient-profile.entity';
import { RecurringAvailability } from '../doctor/recurring-availability.entity';
import { CustomAvailability } from '../doctor/custom-availability.entity';
import { AvailabilityType } from '../doctor/enums/availability-type.enum';

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

describe('AppointmentService', () => {
  let service: AppointmentService;
  let appointmentRepository: ReturnType<typeof mockRepo>;
  let doctorRepository: ReturnType<typeof mockRepo>;
  let patientRepository: ReturnType<typeof mockRepo>;
  let recurringRepository: ReturnType<typeof mockRepo>;
  let customRepository: ReturnType<typeof mockRepo>;

  const doctor: Partial<DoctorProfile> = { id: 1, fullName: 'Dr. Rao' } as any;
  const patient: Partial<PatientProfile> = { id: 1, fullName: 'John' } as any;

  beforeEach(async () => {
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

      expect(result.startTime).toBe('10:40');
      expect(result.endTime).toBe('11:00');
      expect(result.schedulingType).toBe(AvailabilityType.STREAM);
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
  // 10:00-12:00 window, duration 30 (entered directly), capacity 4 per
  // mini-window -> four 30-min waves, 4 patients each.
  // ==========================================
  describe('Wave scheduling', () => {
    const waveAvailability = {
      id: 20,
      type: AvailabilityType.WAVE,
      dayOfWeek: FUTURE_DAY_OF_WEEK,
      startTime: '10:00',
      endTime: '12:00',
      duration: 30,
      bufferTime: 0,
      capacity: 4,
      doctorProfile: doctor,
    };

    it('generates four 30-min mini-windows, each with its own capacity', async () => {
      customRepository.find.mockResolvedValue([]);
      recurringRepository.find.mockResolvedValue([waveAvailability]);
      appointmentRepository.find.mockResolvedValue([
        { startTime: '10:00', endTime: '10:30', status: 'BOOKED' },
        { startTime: '10:00', endTime: '10:30', status: 'BOOKED' },
      ]);

      const result = await service.getPatientAvailability(1, FUTURE_DATE);

      expect(result.sessions[0].schedulingType).toBe(AvailabilityType.WAVE);
      expect(result.sessions[0].windows).toHaveLength(4);
      expect(result.sessions[0]!.windows![0]).toMatchObject({
        timeWindow: '10:00 - 10:30',
        capacity: 4,
        booked: 2,
        available: 2,
        isFull: false,
      });
      expect(result.sessions[0]!.windows![1]).toMatchObject({
        timeWindow: '10:30 - 11:00',
        booked: 0,
        available: 4,
      });
    });

    it('assigns sequential token numbers within the chosen mini-window', async () => {
      recurringRepository.findOne.mockResolvedValue(waveAvailability);
      appointmentRepository.findOne.mockResolvedValue(null); // not already booked by this patient
      appointmentRepository.count.mockResolvedValue(2); // 2 already booked in this wave

      const result = await service.create(1, {
        doctorId: 1,
        appointmentDate: FUTURE_DATE,
        recurringAvailabilityId: 20,
        startTime: '10:30',
      });

      expect(result.tokenNumber).toBe(3);
      expect(result.startTime).toBe('10:30');
      expect(result.endTime).toBe('11:00');
    });

    it('rejects booking once that specific mini-window is at full capacity', async () => {
      recurringRepository.findOne.mockResolvedValue(waveAvailability);
      appointmentRepository.findOne.mockResolvedValue(null);
      appointmentRepository.count.mockResolvedValue(4); // capacity reached

      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 20,
          startTime: '10:00',
        }),
      ).rejects.toThrow('Wave is full');
    });

    it('rejects a duplicate booking by the same patient in the same mini-window', async () => {
      recurringRepository.findOne.mockResolvedValue(waveAvailability);
      appointmentRepository.findOne.mockResolvedValue({ id: 55 }); // already booked

      await expect(
        service.create(1, {
          doctorId: 1,
          appointmentDate: FUTURE_DATE,
          recurringAvailabilityId: 20,
          startTime: '11:00',
        }),
      ).rejects.toThrow('You have already booked a slot in this wave');
    });

    it('rejects a start time that does not match any generated mini-window', async () => {
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
});