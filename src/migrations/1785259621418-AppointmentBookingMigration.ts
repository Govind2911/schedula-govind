import { MigrationInterface, QueryRunner } from "typeorm";

export class AppointmentBookingMigration1785259621418 implements MigrationInterface {
    name = 'AppointmentBookingMigration1785259621418'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."appointments_status_enum" AS ENUM('BOOKED', 'CANCELLED', 'AVAILABLE')`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'BOOKED'`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "UQ_8670feb37e386a2f6f96e912270" UNIQUE ("doctorId", "appointmentDate", "startTime", "endTime")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "UQ_8670feb37e386a2f6f96e912270"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "status" character varying NOT NULL DEFAULT 'BOOKED'`);
    }

}
