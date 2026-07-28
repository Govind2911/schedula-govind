import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { DoctorService } from './doctor.service';
import { DoctorProfile } from './doctor-profile.entity';
import { User } from '../users/user.entity';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { AvailabilityType } from './enums/availability-type.enum';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
});

describe('DoctorService', () => {
  let service: DoctorService;
  let doctorRepository: ReturnType<typeof mockRepo>;
  let userRepository: ReturnType<typeof mockRepo>;
  let recurringAvailabilityRepository: ReturnType<typeof mockRepo>;
  let customAvailabilityRepository: ReturnType<typeof mockRepo>;

  const doctor = { id: 1, user: { id: 1 } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorService,
        { provide: getRepositoryToken(DoctorProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useFactory: mockRepo },
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

    service = module.get<DoctorService>(DoctorService);
    doctorRepository = module.get(getRepositoryToken(DoctorProfile));
    userRepository = module.get(getRepositoryToken(User));
    recurringAvailabilityRepository = module.get(
      getRepositoryToken(RecurringAvailability),
    );
    customAvailabilityRepository = module.get(
      getRepositoryToken(CustomAvailability),
    );

    doctorRepository.findOne.mockResolvedValue(doctor);
    recurringAvailabilityRepository.findOne.mockResolvedValue(null); // no existing conflict by default
    recurringAvailabilityRepository.find.mockResolvedValue([]); // no overlaps by default
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================
  // STREAM: capacity derives the per-patient duration
  // ==========================================
  describe('Stream availability (capacity -> derived duration)', () => {
    it('derives an exact 20-minute duration for a 2-hour window with capacity 6', async () => {
      const result = await service.createRecurringAvailability(1, {
        dayOfWeek: 'Monday',
        type: AvailabilityType.STREAM,
        startTime: '10:00',
        endTime: '12:00',
        capacity: 6,
      } as any);

      expect(result.duration).toBe(20);
    });

    it('accounts for buffer time when deriving duration', async () => {
      // 120 min window, capacity 4, buffer 5 between each of the 3 gaps
      // -> (120 - 5*3) / 4 = 26.25 -> not an integer -> should reject
      await expect(
        service.createRecurringAvailability(1, {
          dayOfWeek: 'Monday',
          type: AvailabilityType.STREAM,
          startTime: '10:00',
          endTime: '12:00',
          capacity: 4,
          bufferTime: 5,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a capacity that does not evenly divide the window', async () => {
      // 60 min window, capacity 7 -> 8.57 min per patient, not an integer
      await expect(
        service.createRecurringAvailability(1, {
          dayOfWeek: 'Monday',
          type: AvailabilityType.STREAM,
          startTime: '10:00',
          endTime: '11:00',
          capacity: 7,
        } as any),
      ).rejects.toThrow(
        'capacity does not evenly divide the availability window',
      );
    });

    it('rejects an invalid (zero) capacity', async () => {
      await expect(
        service.createRecurringAvailability(1, {
          dayOfWeek: 'Monday',
          type: AvailabilityType.STREAM,
          startTime: '10:00',
          endTime: '11:00',
          capacity: 0,
        } as any),
      ).rejects.toThrow('Invalid capacity');
    });
  });

  // ==========================================
  // WAVE: duration is entered directly (mini-window size)
  // ==========================================
  describe('Wave availability (duration entered directly)', () => {
    it('accepts the entered duration as the mini-window size', async () => {
      const result = await service.createRecurringAvailability(1, {
        dayOfWeek: 'Monday',
        type: AvailabilityType.WAVE,
        startTime: '10:00',
        endTime: '12:00',
        duration: 30,
        capacity: 4,
      } as any);

      expect(result.duration).toBe(30);
      expect(result.capacity).toBe(4);
    });

    it('rejects a missing duration for wave scheduling', async () => {
      await expect(
        service.createRecurringAvailability(1, {
          dayOfWeek: 'Monday',
          type: AvailabilityType.WAVE,
          startTime: '10:00',
          endTime: '12:00',
          capacity: 4,
        } as any),
      ).rejects.toThrow('Invalid slot duration');
    });

    it('rejects a duration larger than the availability window', async () => {
      await expect(
        service.createRecurringAvailability(1, {
          dayOfWeek: 'Monday',
          type: AvailabilityType.WAVE,
          startTime: '10:00',
          endTime: '10:30',
          duration: 45,
          capacity: 4,
        } as any),
      ).rejects.toThrow(
        'Slot duration and buffer time exceed the availability window',
      );
    });
  });

  // ==========================================
  // GENERAL EDGE CASES
  // ==========================================
  describe('General edge cases', () => {
    it('rejects when start time is not before end time', async () => {
      await expect(
        service.createRecurringAvailability(1, {
          dayOfWeek: 'Monday',
          type: AvailabilityType.STREAM,
          startTime: '11:00',
          endTime: '10:00',
          capacity: 4,
        } as any),
      ).rejects.toThrow('Start time must be before end time');
    });

    it('rejects an overlapping recurring slot on the same day', async () => {
      recurringAvailabilityRepository.find.mockResolvedValue([
        { startTime: '10:00', endTime: '11:00' },
      ]);

      await expect(
        service.createRecurringAvailability(1, {
          dayOfWeek: 'Monday',
          type: AvailabilityType.STREAM,
          startTime: '10:30',
          endTime: '11:30',
          capacity: 3,
        } as any),
      ).rejects.toThrow('Overlapping availability slot');
    });

    it('throws NotFoundException when the doctor profile does not exist', async () => {
      doctorRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createRecurringAvailability(1, {
          dayOfWeek: 'Monday',
          type: AvailabilityType.STREAM,
          startTime: '10:00',
          endTime: '11:00',
          capacity: 4,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects creating custom availability for a past date', async () => {
      customAvailabilityRepository.find.mockResolvedValue([]);

      await expect(
        service.createCustomAvailability(1, {
          date: '2000-01-01',
          type: AvailabilityType.STREAM,
          startTime: '10:00',
          endTime: '11:00',
          capacity: 4,
        } as any),
      ).rejects.toThrow('Cannot create availability for a past date');
    });

    it('rejects overlapping custom availability on the same date', async () => {
      customAvailabilityRepository.find.mockResolvedValue([
        { startTime: '10:00', endTime: '11:00' },
      ]);

      await expect(
        service.createCustomAvailability(1, {
          date: '2099-06-15',
          type: AvailabilityType.STREAM,
          startTime: '10:30',
          endTime: '11:30',
          capacity: 3,
        } as any),
      ).rejects.toThrow('Overlapping availability slot for this date');
    });
  });
});