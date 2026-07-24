import { MigrationInterface, QueryRunner } from "typeorm";

export class AdvancedAppointmentScheduling1784894028456
  implements MigrationInterface
{
  name = "AdvancedAppointmentScheduling1784894028456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add bufferTime to recurring availability
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
      ADD COLUMN IF NOT EXISTS "bufferTime" integer NOT NULL DEFAULT 0;
    `);

    // Add bufferTime to custom availability
    await queryRunner.query(`
      ALTER TABLE "custom_availability"
      ADD COLUMN IF NOT EXISTS "bufferTime" integer NOT NULL DEFAULT 0;
    `);

    // Rename old enum
    await queryRunner.query(`
      ALTER TYPE "public"."recurring_availability_type_enum"
      RENAME TO "recurring_availability_type_enum_old";
    `);

    // Create new enum
    await queryRunner.query(`
      CREATE TYPE "public"."recurring_availability_type_enum"
      AS ENUM ('STREAM','WAVE');
    `);

    // Remove default
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
      ALTER COLUMN "type" DROP DEFAULT;
    `);

    // Convert old values
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
      ALTER COLUMN "type"
      TYPE "public"."recurring_availability_type_enum"
      USING (
        CASE
          WHEN type::text='VIEW' THEN 'WAVE'
          ELSE type::text
        END
      )::"public"."recurring_availability_type_enum";
    `);

    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
      ALTER COLUMN "type"
      SET DEFAULT 'STREAM';
    `);

    await queryRunner.query(`
      DROP TYPE "public"."recurring_availability_type_enum_old";
    `);

    // ---------- Custom Availability Enum ----------

    await queryRunner.query(`
      ALTER TYPE "public"."custom_availability_type_enum"
      RENAME TO "custom_availability_type_enum_old";
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."custom_availability_type_enum"
      AS ENUM ('STREAM','WAVE');
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_availability"
      ALTER COLUMN "type" DROP DEFAULT;
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_availability"
      ALTER COLUMN "type"
      TYPE "public"."custom_availability_type_enum"
      USING (
        CASE
          WHEN type::text='VIEW' THEN 'WAVE'
          ELSE type::text
        END
      )::"public"."custom_availability_type_enum";
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_availability"
      ALTER COLUMN "type"
      SET DEFAULT 'STREAM';
    `);

    await queryRunner.query(`
      DROP TYPE "public"."custom_availability_type_enum_old";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
      DROP COLUMN IF EXISTS "bufferTime";
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_availability"
      DROP COLUMN IF EXISTS "bufferTime";
    `);
  }
}