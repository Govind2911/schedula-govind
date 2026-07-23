import { MigrationInterface, QueryRunner } from "typeorm";

export class DoctorAvailability1784813968653 implements MigrationInterface {
    name = 'DoctorAvailability1784813968653'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "doctor_profile" DROP CONSTRAINT "FK_doctor_profile_user"`);
        await queryRunner.query(`ALTER TABLE "patient_profile" DROP CONSTRAINT "FK_patient_profile_user"`);
        await queryRunner.query(`CREATE TYPE "public"."recurring_availability_type_enum" AS ENUM('VIEW', 'STREAM')`);
        await queryRunner.query(`CREATE TABLE "recurring_availability" ("id" SERIAL NOT NULL, "dayOfWeek" character varying NOT NULL, "type" "public"."recurring_availability_type_enum" NOT NULL DEFAULT 'VIEW', "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "duration" integer NOT NULL, "capacity" integer NOT NULL, "isRecurring" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "doctorProfileId" integer, CONSTRAINT "PK_2464dd095ba418858c1aa3f4e01" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."custom_availability_type_enum" AS ENUM('VIEW', 'STREAM')`);
        await queryRunner.query(`CREATE TABLE "custom_availability" ("id" SERIAL NOT NULL, "date" date NOT NULL, "type" "public"."custom_availability_type_enum" NOT NULL DEFAULT 'VIEW', "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "duration" integer NOT NULL, "capacity" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "doctorProfileId" integer, CONSTRAINT "PK_e9b8fa5803ca3d6554a7ddf7045" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ADD CONSTRAINT "FK_988d39de6521504d5dc9ac0b9f5" FOREIGN KEY ("doctorProfileId") REFERENCES "doctor_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "custom_availability" ADD CONSTRAINT "FK_4b01248ade4901e776f8ed260f8" FOREIGN KEY ("doctorProfileId") REFERENCES "doctor_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doctor_profile" ADD CONSTRAINT "FK_f3a33e785199cebab93b11d1237" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_profile" ADD CONSTRAINT "FK_1de3767e7d351c683f4f8923aef" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_profile" DROP CONSTRAINT "FK_1de3767e7d351c683f4f8923aef"`);
        await queryRunner.query(`ALTER TABLE "doctor_profile" DROP CONSTRAINT "FK_f3a33e785199cebab93b11d1237"`);
        await queryRunner.query(`ALTER TABLE "custom_availability" DROP CONSTRAINT "FK_4b01248ade4901e776f8ed260f8"`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" DROP CONSTRAINT "FK_988d39de6521504d5dc9ac0b9f5"`);
        await queryRunner.query(`DROP TABLE "custom_availability"`);
        await queryRunner.query(`DROP TYPE "public"."custom_availability_type_enum"`);
        await queryRunner.query(`DROP TABLE "recurring_availability"`);
        await queryRunner.query(`DROP TYPE "public"."recurring_availability_type_enum"`);
        await queryRunner.query(`ALTER TABLE "patient_profile" ADD CONSTRAINT "FK_patient_profile_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doctor_profile" ADD CONSTRAINT "FK_doctor_profile_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
