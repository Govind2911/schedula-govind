import {
  IsString,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateDoctorProfileDto {
  @IsString()
  fullName!: string;

  @IsString()
  specialization!: string;

  @IsNumber()
  experience!: number;

  @IsString()
  qualification!: string;

  @IsNumber()
  consultationFee!: number;

  @IsString()
  availability!: string;

  @IsOptional()
  @IsString()
  profileDetails?: string;
}