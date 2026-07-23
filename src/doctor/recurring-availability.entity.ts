import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';

export enum AvailabilityType {
  VIEW = 'VIEW',
  STREAM = 'STREAM',
}

@Entity('recurring_availability')
export class RecurringAvailability {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  dayOfWeek!: string;

  @Column({
    type: 'enum',
    enum: AvailabilityType,
    default: AvailabilityType.VIEW,
  })
  type!: AvailabilityType;

  @Column({ type: 'time' })
  startTime!: string;

  @Column({ type: 'time' })
  endTime!: string;

  @Column()
  duration!: number;

  @Column()
  capacity!: number;

  @Column({ default: true })
  isRecurring!: boolean;

  @ManyToOne(
    () => DoctorProfile,
    (doctorProfile) => doctorProfile.recurringAvailabilities,
    {
      onDelete: 'CASCADE',
    },
  )
  doctorProfile!: DoctorProfile;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}