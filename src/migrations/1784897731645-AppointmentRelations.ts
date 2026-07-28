import { MigrationInterface, QueryRunner } from "typeorm";

export class AppointmentRelations1784897731645 implements MigrationInterface {
    name = 'AppointmentRelations1784897731645'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."appointments_schedulingtype_enum" AS ENUM('STREAM', 'WAVE')`);
        await queryRunner.query(`CREATE TABLE "appointments" ("id" SERIAL NOT NULL, "appointmentDate" date NOT NULL, "schedulingType" "public"."appointments_schedulingtype_enum" NOT NULL DEFAULT 'STREAM', "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "tokenNumber" integer, "status" character varying NOT NULL DEFAULT 'BOOKED', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "doctorId" integer, "patientId" integer, "recurringAvailabilityId" integer, "customAvailabilityId" integer, CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_0c1af27b469cb8dca420c160d65" FOREIGN KEY ("doctorId") REFERENCES "doctor_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_13c2e57cb81b44f062ba24df57d" FOREIGN KEY ("patientId") REFERENCES "patient_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_192894c8882bc57dd719293843f" FOREIGN KEY ("recurringAvailabilityId") REFERENCES "recurring_availability"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_852041522741282b3f96b5501fa" FOREIGN KEY ("customAvailabilityId") REFERENCES "custom_availability"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_852041522741282b3f96b5501fa"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_192894c8882bc57dd719293843f"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_13c2e57cb81b44f062ba24df57d"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_0c1af27b469cb8dca420c160d65"`);
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_schedulingtype_enum"`);
    }

}
