import { MigrationInterface, QueryRunner } from "typeorm";

export class AppointmentScheduling1784890113855 implements MigrationInterface {
    name = "AppointmentScheduling1784890113855";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // No schema changes required here.
        // Day 5 implementation will be handled in services/controllers.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Nothing to rollback.
    }
}