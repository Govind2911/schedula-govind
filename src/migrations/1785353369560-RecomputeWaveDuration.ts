import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Prior to this migration, WAVE availability rows stored a doctor-entered
 * mini-window `duration` (e.g. 30 minutes shared by up to `capacity`
 * patients). WAVE now derives the per-patient slot duration automatically,
 * the same way STREAM does: by splitting the whole session evenly across
 * `capacity`, accounting for `bufferTime` between consecutive patients.
 *
 * This migration recomputes `duration` for existing WAVE rows so already
 * saved availability keeps working under the new one-patient-per-slot
 * model instead of silently keeping its old (now meaningless) mini-window
 * duration. STREAM rows are untouched.
 */
export class RecomputeWaveDuration1785600000000 implements MigrationInterface {
  name = 'RecomputeWaveDuration1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "recurring_availability"
      SET "duration" = GREATEST(
        FLOOR(
          (
            (EXTRACT(EPOCH FROM "endTime"::time) - EXTRACT(EPOCH FROM "startTime"::time)) / 60
            - ("bufferTime" * ("capacity" - 1))
          ) / "capacity"
        ),
        1
      )
      WHERE "type" = 'WAVE';
    `);

    await queryRunner.query(`
      UPDATE "custom_availability"
      SET "duration" = GREATEST(
        FLOOR(
          (
            (EXTRACT(EPOCH FROM "endTime"::time) - EXTRACT(EPOCH FROM "startTime"::time)) / 60
            - ("bufferTime" * ("capacity" - 1))
          ) / "capacity"
        ),
        1
      )
      WHERE "type" = 'WAVE';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The original doctor-entered mini-window duration values cannot be
    // recovered once overwritten, so this migration is not reversible.
    // Doctors should re-save affected WAVE availability if a rollback is
    // required.
  }
}
