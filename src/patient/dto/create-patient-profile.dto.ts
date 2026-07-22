import {
  IsString,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreatePatientProfileDto {
  @IsString()
  fullName!: string;

  @IsNumber()
  age!: number;

  @IsString()
  gender!: string;

  @IsString()
  contactDetails!: string;

  @IsOptional()
  @IsString()
  basicHealthInformation?: string;
}