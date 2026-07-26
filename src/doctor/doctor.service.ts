import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DoctorProfile } from './doctor-profile.entity';
import { User } from '../users/user.entity';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { AvailabilityType } from './enums/availability-type.enum';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(DoctorProfile)
    private readonly doctorRepository: Repository<DoctorProfile>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(RecurringAvailability)
    private readonly recurringAvailabilityRepository: Repository<RecurringAvailability>,

    @InjectRepository(CustomAvailability)
    private readonly customAvailabilityRepository: Repository<CustomAvailability>,
  ) {}

  async createProfile(
    userId: number,
    createDoctorProfileDto: CreateDoctorProfileDto,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingProfile = await this.doctorRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (existingProfile) {
      throw new BadRequestException(
        'Doctor profile already exists',
      );
    }

    const profile = this.doctorRepository.create({
      ...createDoctorProfileDto,
      user,
    });

    return await this.doctorRepository.save(profile);
  }

  async getProfile(userId: number) {
    const profile = await this.doctorRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
      relations: {
        user: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }

    return profile;
  }

  async updateProfile(
    userId: number,
    updateDoctorProfileDto: UpdateDoctorProfileDto,
  ) {
    const profile = await this.doctorRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }

    Object.assign(profile, updateDoctorProfileDto);

    return await this.doctorRepository.save(profile);
  }

  async createRecurringAvailability(
    userId: number,
    dto: CreateRecurringAvailabilityDto,
  ) {
    const doctor = await this.doctorRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found',
      );
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException(
        'Start time must be before end time',
      );
    }

    this.validateAvailabilityConfig(dto);

    const existingAvailability =
  await this.recurringAvailabilityRepository.findOne({
    where: {
      doctorProfile: {
        id: doctor.id,
      },
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
    },
  });

if (existingAvailability) {
  throw new BadRequestException(
    'Availability already exists',
  );
}
const existingSlots =
  await this.recurringAvailabilityRepository.find({
    where: {
      doctorProfile: {
        id: doctor.id,
      },
      dayOfWeek: dto.dayOfWeek,
    },
  });

for (const slot of existingSlots) {
  if (
    dto.startTime < slot.endTime &&
    dto.endTime > slot.startTime
  ) {
    throw new BadRequestException(
      'Overlapping availability slot',
    );
  }
}

    const availability =
      this.recurringAvailabilityRepository.create({
        ...dto,
        doctorProfile: doctor,
      });

    return this.recurringAvailabilityRepository.save(
      availability,
    );
  }

  async getRecurringAvailability(userId: number) {
    const doctor = await this.doctorRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found',
      );
    }

    return await this.recurringAvailabilityRepository.find({
      where: {
        doctorProfile: {
          id: doctor.id,
        },
      },
      order: {
        dayOfWeek: 'ASC',
        startTime: 'ASC',
      },
    });
  }

  async updateRecurringAvailability(
  userId: number,
  id: number,
  dto: UpdateRecurringAvailabilityDto,
) {
  const availability =
    await this.recurringAvailabilityRepository.findOne({
      where: {
        id,
      },
      relations: {
        doctorProfile: {
          user: true,
        },
      },
    });

  if (!availability) {
    throw new NotFoundException(
      'Availability not found',
    );
  }

  if (availability.doctorProfile.user.id !== userId) {
    throw new BadRequestException(
      'You are not allowed to update this availability',
    );
  }

  if (
    dto.startTime &&
    dto.endTime &&
    dto.startTime >= dto.endTime
  ) {
    throw new BadRequestException(
      'Start time must be before end time',
    );
  }

  Object.assign(availability, dto);

  return await this.recurringAvailabilityRepository.save(
    availability,
  );
}

async deleteRecurringAvailability(
  userId: number,
  id: number,
) {
  const availability =
    await this.recurringAvailabilityRepository.findOne({
      where: {
        id,
      },
      relations: {
        doctorProfile: {
          user: true,
        },
      },
    });

  if (!availability) {
    throw new NotFoundException(
      'Availability not found',
    );
  }

  if (availability.doctorProfile.user.id !== userId) {
    throw new BadRequestException(
      'You are not allowed to delete this availability',
    );
  }

  await this.recurringAvailabilityRepository.remove(
    availability,
  );

  return {
    message: 'Availability deleted successfully',
  };
}
async createCustomAvailability(
  userId: number,
  dto: CreateCustomAvailabilityDto,
) {
  const doctor = await this.doctorRepository.findOne({
    where: {
      user: {
        id: userId,
      },
    },
  });

  if (!doctor) {
    throw new NotFoundException(
      'Doctor profile not found',
    );
  }

  if (dto.startTime >= dto.endTime) {
    throw new BadRequestException(
      'Start time must be before end time',
    );
  }

  this.validateAvailabilityConfig(dto);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dto.date);

  if (Number.isNaN(targetDate.getTime())) {
    throw new BadRequestException('Invalid date');
  }

  if (targetDate < today) {
    throw new BadRequestException(
      'Cannot create availability for a past date',
    );
  }

  const existingForDate =
    await this.customAvailabilityRepository.find({
      where: {
        doctorProfile: {
          id: doctor.id,
        },
        date: dto.date,
      },
    });

  for (const slot of existingForDate) {
    if (
      dto.startTime < slot.endTime &&
      dto.endTime > slot.startTime
    ) {
      throw new BadRequestException(
        'Overlapping availability slot for this date',
      );
    }
  }

  const availability =
    this.customAvailabilityRepository.create({
      ...dto,
      doctorProfile: doctor,
    });

  return await this.customAvailabilityRepository.save(
    availability,
  );
}

private validateAvailabilityConfig(dto: {
  type: AvailabilityType;
  startTime: string;
  endTime: string;
  duration: number;
  bufferTime?: number;
  capacity: number;
}) {
  if (!dto.duration || dto.duration <= 0) {
    throw new BadRequestException('Invalid slot duration');
  }

  if (dto.bufferTime !== undefined && dto.bufferTime < 0) {
    throw new BadRequestException('Invalid buffer time');
  }

  if (!dto.capacity || dto.capacity < 1) {
    throw new BadRequestException('Invalid capacity');
  }

  const [startHour, startMinute] = dto.startTime.split(':').map(Number);
  const [endHour, endMinute] = dto.endTime.split(':').map(Number);
  const windowMinutes =
    endHour * 60 + endMinute - (startHour * 60 + startMinute);

  if (dto.type === AvailabilityType.STREAM) {
    const step = dto.duration + (dto.bufferTime ?? 0);
    if (step > windowMinutes) {
      throw new BadRequestException(
        'Slot duration and buffer time exceed the availability window',
      );
    }
  }
}

async getAvailabilityByDate(
  userId: number,
  date: string,
) {
  const doctor = await this.doctorRepository.findOne({
    where: {
      user: {
        id: userId,
      },
    },
  });

  if (!doctor) {
    throw new NotFoundException(
      'Doctor profile not found',
    );
  }

  const customAvailability =
    await this.customAvailabilityRepository.find({
      where: {
        doctorProfile: {
          id: doctor.id,
        },
        date,
      },
    });

  if (customAvailability.length > 0) {
    return customAvailability;
  }

  const dayOfWeek = new Date(date).toLocaleDateString(
    'en-US',
    {
      weekday: 'long',
    },
  );

  return await this.recurringAvailabilityRepository.find({
    where: {
      doctorProfile: {
        id: doctor.id,
      },
      dayOfWeek,
    },
  });
}

}