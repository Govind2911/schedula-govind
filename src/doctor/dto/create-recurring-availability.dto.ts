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

  @IsInt()
  @Min(5)
  duration!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  @IsInt()
  @Min(1)
  capacity!: number;
}