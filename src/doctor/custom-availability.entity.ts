import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';
import { AvailabilityType } from './recurring-availability.entity';

@Entity('custom_availability')
export class CustomAvailability {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'date' })
  date!: string;

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

  @ManyToOne(
    () => DoctorProfile,
    (doctorProfile) => doctorProfile.customAvailabilities,
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