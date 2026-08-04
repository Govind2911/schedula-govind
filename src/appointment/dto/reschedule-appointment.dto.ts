import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString()
  appointmentDate!: string;

  @IsString()
  startTime!: string;

  // Optional: pick a different availability row to move to (e.g. a
  // different day's recurring session, or a doctor's custom date). If
  // omitted, the appointment's current availability reference is reused
  // and only the date/time within it changes.
  @IsOptional()
  @IsInt()
  recurringAvailabilityId?: number;

  @IsOptional()
  @IsInt()
  customAvailabilityId?: number;
}