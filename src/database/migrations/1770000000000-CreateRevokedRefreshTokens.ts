import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRevokedRefreshTokens1770000000000
  implements MigrationInterface
{
  name = 'CreateRevokedRefreshTokens1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "revoked_refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "jti" character varying(255) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_revoked_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_revoked_refresh_tokens_jti" UNIQUE ("jti")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_revoked_refresh_tokens_expiresAt" ON "revoked_refresh_tokens" ("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_revoked_refresh_tokens_expiresAt"`,
    );
    await queryRunner.query(`DROP TABLE "revoked_refresh_tokens"`);
  }
}
