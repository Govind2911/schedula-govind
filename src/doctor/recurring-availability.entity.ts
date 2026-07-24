import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';
import { AvailabilityType } from './enums/availability-type.enum';

@Entity('recurring_availability')
export class RecurringAvailability {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  dayOfWeek!: string;

  @Column({
    type: 'enum',
    enum: AvailabilityType,
    default: AvailabilityType.STREAM,
  })
  type!: AvailabilityType;

  @Column({ type: 'time' })
  startTime!: string;

  @Column({ type: 'time' })
  endTime!: string;

  @Column()
  duration!: number;

  @Column({ default: 0 })
  bufferTime!: number;

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