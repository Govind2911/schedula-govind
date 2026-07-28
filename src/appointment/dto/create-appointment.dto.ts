import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsInt()
  doctorId!: number;

  @IsDateString()
  appointmentDate!: string;

  @IsOptional()
  @IsInt()
  recurringAvailabilityId?: number;

  @IsOptional()
  @IsInt()
  customAvailabilityId?: number;

  @IsOptional()
  @IsString()
  startTime?: string;
}