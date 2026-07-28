import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

import { AvailabilityType } from '../enums/availability-type.enum';
export class CreateRecurringAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  dayOfWeek!: string;

  @IsEnum(AvailabilityType)
  type!: AvailabilityType;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime!: string;

  // Only required for WAVE, where it's the size of each mini-window
  // (wave). For STREAM the per-patient duration is derived automatically
  // by splitting the window evenly across `capacity`, so this field
  // should be omitted.
  @ValidateIf((o) => o.type === AvailabilityType.WAVE)
  @IsInt()
  @Min(5)
  duration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  // STREAM: total number of patients across the whole window (used to
  // derive the per-slot duration).
  // WAVE: max patients per mini-window (wave).
  @IsInt()
  @Min(1)
  capacity!: number;
}