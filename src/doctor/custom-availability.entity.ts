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

@Entity('custom_availability')
export class CustomAvailability {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'date' })
  date!: string;

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