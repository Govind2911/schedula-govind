import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('patient_profile')
export class PatientProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  fullName!: string;

  @Column()
  age!: number;

  @Column()
  gender!: string;

  @Column()
  contactDetails!: string;

  @Column({ nullable: true })
  basicHealthInformation!: string;

 @OneToOne(() => User, (user) => user.patientProfile)
  @JoinColumn()
  user!: User;
}