import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { AvailabilityType } from '../recurring-availability.entity';

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

  @IsInt()
  @Min(5)
  duration!: number;

  @IsInt()
  @Min(1)
  capacity!: number;
}