import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1753191000000 implements MigrationInterface {
  name = 'CreateUsers1753191000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM ('DOCTOR', 'PATIENT');
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "fullName" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users";`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum";`);
  }
}