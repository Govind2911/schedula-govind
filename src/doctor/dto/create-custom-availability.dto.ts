import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { AvailabilityType } from '../enums/availability-type.enum';

export class CreateCustomAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsEnum(AvailabilityType)
  type!: AvailabilityType;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime!: string;

  // Not required for either scheduling type: the per-patient slot length
  // is always derived automatically by splitting the availability window
  // evenly across `capacity` (accounting for `bufferTime` between
  // consecutive patients). Any value sent here is ignored.
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  // Total number of patients across the whole session, for both STREAM
  // and WAVE. Used to derive the per-patient slot duration.
  @IsInt()
  @Min(1)
  capacity!: number;
}