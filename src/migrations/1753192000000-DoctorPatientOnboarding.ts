import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorPatientOnboarding1753192000000
  implements MigrationInterface
{
  name = 'DoctorPatientOnboarding1753192000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create Doctor Profile table
    await queryRunner.query(`
      CREATE TABLE "doctor_profile" (
        "id" SERIAL NOT NULL,
        "fullName" character varying NOT NULL,
        "specialization" character varying NOT NULL,
        "experience" integer NOT NULL,
        "qualification" character varying NOT NULL,
        "consultationFee" decimal NOT NULL,
        "availability" character varying NOT NULL,
        "profileDetails" character varying,
        "userId" integer,
        CONSTRAINT "PK_doctor_profile" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_doctor_profile_user" UNIQUE ("userId")
      );
    `);

    // Create Patient Profile table
    await queryRunner.query(`
      CREATE TABLE "patient_profile" (
        "id" SERIAL NOT NULL,
        "fullName" character varying NOT NULL,
        "age" integer NOT NULL,
        "gender" character varying NOT NULL,
        "contactDetails" character varying NOT NULL,
        "basicHealthInformation" character varying,
        "userId" integer,
        CONSTRAINT "PK_patient_profile" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_patient_profile_user" UNIQUE ("userId")
      );
    `);

    // Doctor -> Users FK
    await queryRunner.query(`
      ALTER TABLE "doctor_profile"
      ADD CONSTRAINT "FK_doctor_profile_user"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION;
    `);

    // Patient -> Users FK
    await queryRunner.query(`
      ALTER TABLE "patient_profile"
      ADD CONSTRAINT "FK_patient_profile_user"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_profile"
      DROP CONSTRAINT "FK_doctor_profile_user";
    `);

    await queryRunner.query(`
      ALTER TABLE "patient_profile"
      DROP CONSTRAINT "FK_patient_profile_user";
    `);

    await queryRunner.query(`DROP TABLE "doctor_profile";`);
    await queryRunner.query(`DROP TABLE "patient_profile";`);
  }
}