import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PatientProfile } from './patient-profile.entity';
import { User } from '../users/user.entity';

import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly patientRepository: Repository<PatientProfile>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createProfile(
    userId: number,
    createPatientProfileDto: CreatePatientProfileDto,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingProfile = await this.patientRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (existingProfile) {
      throw new BadRequestException(
        'Patient profile already exists',
      );
    }

    const profile = this.patientRepository.create({
      ...createPatientProfileDto,
      user,
    });

    return await this.patientRepository.save(profile);
  }

  async getProfile(userId: number) {
    const profile = await this.patientRepository.findOne({
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
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    return profile;
  }

  async updateProfile(
    userId: number,
    updatePatientProfileDto: UpdatePatientProfileDto,
  ) {
    const profile = await this.patientRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    Object.assign(profile, updatePatientProfileDto);

    return await this.patientRepository.save(profile);
  }
}