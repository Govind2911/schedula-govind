import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DoctorProfile } from '../../doctor/doctor-profile.entity';
import { PatientProfile } from '../../patient/patient-profile.entity';
import { AvailabilityType } from '../../doctor/enums/availability-type.enum';
import { RecurringAvailability } from '../../doctor/recurring-availability.entity';
import { CustomAvailability } from '../../doctor/custom-availability.entity';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => DoctorProfile, {
    onDelete: 'CASCADE',
  })
  doctor!: DoctorProfile;

  @ManyToOne(() => PatientProfile, {
    onDelete: 'CASCADE',
  })
  patient!: PatientProfile;

  @ManyToOne(() => RecurringAvailability, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  recurringAvailability?: RecurringAvailability;

  @ManyToOne(() => CustomAvailability, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  customAvailability?: CustomAvailability;

  @Column({ type: 'date' })
  appointmentDate!: string;

  @Column({
  type: 'enum',
  enum: AvailabilityType,
  default: AvailabilityType.STREAM,
})
schedulingType!: AvailabilityType;

  @Column({ type: 'time' })
  startTime!: string;

  @Column({ type: 'time' })
  endTime!: string;

  @Column({ nullable: true })
  tokenNumber?: number;

  @Column({
    default: 'BOOKED',
  })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
 updatedAt!: Date;
}