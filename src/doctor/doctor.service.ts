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

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(DoctorProfile)
    private readonly doctorRepository: Repository<DoctorProfile>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
}