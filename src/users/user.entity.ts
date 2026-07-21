import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Role {
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  fullName!: string;

  @Column({
    unique: true,
  })
  email!: string;

  @Column()
  password!: string;

  @Column({
    type: 'enum',
    enum: Role,
  })
  role!: Role;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}