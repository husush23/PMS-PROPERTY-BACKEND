import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1767118691573 implements MigrationInterface {
  name = 'InitialSchema1767118691573';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying, "isActive" boolean NOT NULL DEFAULT true, "isSuperAdmin" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_companies_role_enum" AS ENUM('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'LANDLORD', 'STAFF', 'TENANT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "companyId" uuid NOT NULL, "role" "public"."user_companies_role_enum" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0b5b4fd1b21f221e3f91a438d93" UNIQUE ("userId", "companyId"), CONSTRAINT "PK_f41bd3ea569c8c877b9a9063abb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fbcec9c4908de8338081b5bfeb" ON "user_companies" ("companyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_295e2ec0606b47e50687ff46c3" ON "user_companies" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying, "address" character varying, "phone" character varying, "email" character varying, "logo" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3dacbb3eb4f095e29372ff8e131" UNIQUE ("name"), CONSTRAINT "UQ_b28b07d25e4324eee577de5496d" UNIQUE ("slug"), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."properties_propertytype_enum" AS ENUM('APARTMENT', 'HOUSE', 'COMMERCIAL', 'CONDO', 'TOWNHOUSE', 'MIXED_USE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."properties_status_enum" AS ENUM('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'UNAVAILABLE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "properties" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "companyId" uuid NOT NULL, "propertyType" "public"."properties_propertytype_enum" NOT NULL, "status" "public"."properties_status_enum" NOT NULL DEFAULT 'AVAILABLE', "address" character varying, "city" character varying, "state" character varying, "zipCode" character varying, "country" character varying, "phone" character varying, "email" character varying, "description" text, "latitude" numeric(10,7), "longitude" numeric(10,7), "yearBuilt" integer, "squareFootage" integer, "floors" integer, "parkingSpaces" integer, "totalUnits" integer, "images" json, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2d83bfa0b9fcd45dee1785af44d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9ea179f3777f6d78a274a3f201" ON "properties" ("companyId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b8a33773574f818b93eb6a78b4" ON "properties" ("propertyType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9cd2513cd04f57c9967f640b0a" ON "properties" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cec911f4e8121d16a8f9a7b031" ON "properties" ("companyId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."units_status_enum" AS ENUM('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'UNAVAILABLE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."units_unittype_enum" AS ENUM('STUDIO', 'ONE_BEDROOM', 'TWO_BEDROOM', 'THREE_BEDROOM', 'FOUR_PLUS_BEDROOM', 'SHOP', 'COMMERCIAL', 'STORAGE', 'PARKING', 'PENTHOUSE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."units_leasetype_enum" AS ENUM('SHORT_TERM', 'LONG_TERM', 'MONTH_TO_MONTH')`,
    );
    await queryRunner.query(
      `CREATE TABLE "units" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "propertyId" uuid NOT NULL, "companyId" uuid NOT NULL, "unitNumber" character varying NOT NULL, "status" "public"."units_status_enum" NOT NULL DEFAULT 'AVAILABLE', "unitType" "public"."units_unittype_enum" NOT NULL, "monthlyRent" numeric(10,2) NOT NULL, "squareFootage" integer, "bedrooms" integer, "bathrooms" numeric(3,1), "depositAmount" numeric(10,2), "floorNumber" integer, "description" text, "images" json, "features" json, "notes" text, "leaseType" "public"."units_leasetype_enum", "hasParking" boolean, "parkingSpotNumber" character varying, "petFriendly" boolean, "furnished" boolean, "utilitiesIncluded" boolean, "utilityNotes" text, "lateFeeAmount" numeric(10,2), "petDeposit" numeric(10,2), "petRent" numeric(10,2), "accessCode" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_177f53e2c2545127efe2fe8a8d2" UNIQUE ("propertyId", "unitNumber"), CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_452076bf093c729d6fcf363a9f" ON "units" ("propertyId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_43714c4d2bdfcca2c28fa2c4ea" ON "units" ("unitType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_37768e6e1261ee85920f8a387d" ON "units" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0be597f225559f5550ef4d640" ON "units" ("companyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_546f4aa111022d983a32103048" ON "units" ("propertyId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "price" numeric(10,2) NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tenant_profiles_status_enum" AS ENUM('PENDING', 'ACTIVE', 'FORMER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "companyId" uuid NOT NULL, "phone" character varying, "alternativePhone" character varying, "dateOfBirth" date, "idNumber" character varying, "idType" character varying, "address" character varying, "city" character varying, "state" character varying, "zipCode" character varying, "country" character varying, "emergencyContactName" character varying, "emergencyContactPhone" character varying, "emergencyContactRelationship" text, "status" "public"."tenant_profiles_status_enum" NOT NULL DEFAULT 'PENDING', "notes" text, "tags" json, "emailNotifications" boolean DEFAULT true, "smsNotifications" boolean DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_31023b57bcb389a9a2e378b3211" UNIQUE ("userId", "companyId"), CONSTRAINT "REL_b8a59063604d0b6d659548da5a" UNIQUE ("userId"), CONSTRAINT "PK_2a7607ec8fe2028dc77670f64c8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d6329fff49d3b9f3c6b1dabb06" ON "tenant_profiles" ("companyId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9484191f37ec856d966f87c0a4" ON "tenant_profiles" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_de6f7c888d6661227616ff312f" ON "tenant_profiles" ("companyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b8a59063604d0b6d659548da5a" ON "tenant_profiles" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leases_status_enum" AS ENUM('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leases_leasetype_enum" AS ENUM('SHORT_TERM', 'LONG_TERM', 'MONTH_TO_MONTH')`,
    );
    await queryRunner.query(
      `CREATE TABLE "leases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "unitId" uuid NOT NULL, "companyId" uuid NOT NULL, "landlordUserId" uuid, "leaseNumber" character varying, "status" "public"."leases_status_enum" NOT NULL DEFAULT 'DRAFT', "leaseType" "public"."leases_leasetype_enum" NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "moveInDate" date, "moveOutDate" date, "signedDate" date, "renewalDate" date, "noticeToVacateDate" date, "billingStartDate" date, "proratedFirstMonth" boolean NOT NULL DEFAULT false, "gracePeriodDays" integer NOT NULL DEFAULT '0', "monthlyRent" numeric(10,2) NOT NULL, "securityDeposit" numeric(10,2), "petDeposit" numeric(10,2), "petRent" numeric(10,2), "lateFeeAmount" numeric(10,2), "utilitiesIncluded" boolean NOT NULL DEFAULT false, "utilityCosts" numeric(10,2), "currency" character varying NOT NULL DEFAULT 'KES', "terminationReason" character varying, "terminatedBy" uuid, "terminationNotes" text, "actualTerminationDate" date, "renewedFromLeaseId" uuid, "renewedToLeaseId" uuid, "leaseTerm" integer, "renewalOptions" text, "noticePeriod" integer, "petPolicy" text, "smokingPolicy" text, "terms" text, "coTenants" json, "guarantorInfo" json, "documents" json, "notes" text, "tags" json, "createdBy" uuid, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2668e338ab2d27079170ea55ea2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f53b37aabe10e2a1033d05b2c" ON "leases" ("endDate") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf00ca6c0fc2f9202dda9304ff" ON "leases" ("startDate") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_999e1e0b307266b4578e02fca5" ON "leases" ("unitId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f04ca7b565c329d2a6f1b73c0f" ON "leases" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_35ba530fe49310f0dc16748b55" ON "leases" ("companyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_175030e58c0d1accdb888a431d" ON "leases" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41ddb25063485103a828efc408" ON "leases" ("unitId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_paymentmethod_enum" AS ENUM('CASH', 'BANK', 'MPESA', 'CARD', 'CHECK', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_paymenttype_enum" AS ENUM('RENT', 'DEPOSIT', 'LATE_FEE', 'UTILITY', 'PET_DEPOSIT', 'PET_RENT', 'MAINTENANCE', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL, "tenantId" uuid NOT NULL, "leaseId" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL DEFAULT 'KES', "paymentDate" date NOT NULL, "paymentMethod" "public"."payments_paymentmethod_enum" NOT NULL, "paymentType" "public"."payments_paymenttype_enum" NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "reference" character varying, "recordedBy" uuid NOT NULL, "period" character varying, "notes" text, "isPartial" boolean NOT NULL DEFAULT false, "balanceAfter" numeric(10,2), "attachmentUrl" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d94f28cc215bf9e685c73e014b" ON "payments" ("leaseId", "paymentDate") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_39eee28b1f5056d199f4ed2c1c" ON "payments" ("companyId", "tenantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_32b41cdb985a296213e9a928b5" ON "payments" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_27faf14e8959f0e40d7b722dc0" ON "payments" ("paymentDate") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d0e156af6bcda64dc420f44ae1" ON "payments" ("leaseId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_98a04cdcbac4f6a2c55c7d1935" ON "payments" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_79fa12c269730f9e1eb40b09d3" ON "payments" ("companyId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_invitations_role_enum" AS ENUM('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'LANDLORD', 'STAFF', 'TENANT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_invitations_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "companyId" uuid NOT NULL, "role" "public"."company_invitations_role_enum" NOT NULL, "token" character varying NOT NULL, "status" "public"."company_invitations_status_enum" NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP NOT NULL, "invitedBy" uuid NOT NULL, "acceptedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d12b21996dce25ab816deffe573" UNIQUE ("token"), CONSTRAINT "UQ_d12b21996dce25ab816deffe573" UNIQUE ("token"), CONSTRAINT "PK_f73da096e85d9dcfaee9fb4ea5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e5340e04f80f443829089af80" ON "company_invitations" ("email", "companyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_265e3e740b00f6ba3f5f3ccb0c" ON "company_invitations" ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9955c6fc3e8c37d502265ce846" ON "company_invitations" ("companyId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tenant_invitations_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "companyId" uuid NOT NULL, "tenantProfileId" uuid, "token" character varying NOT NULL, "status" "public"."tenant_invitations_status_enum" NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP NOT NULL, "invitedBy" uuid NOT NULL, "acceptedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_79964092dc2230851858fa1ab78" UNIQUE ("token"), CONSTRAINT "UQ_79964092dc2230851858fa1ab78" UNIQUE ("token"), CONSTRAINT "PK_830d0f78b435fdcf23b84cc28da" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd230c7339c22fed2aa387529e" ON "tenant_invitations" ("tenantProfileId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dbb992b1e69267c7b89e45307c" ON "tenant_invitations" ("email", "companyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b77424e8049ff41872f6b0291a" ON "tenant_invitations" ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c8099066c8aa54ea0df9db0f9d" ON "tenant_invitations" ("companyId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_companies" ADD CONSTRAINT "FK_295e2ec0606b47e50687ff46c34" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_companies" ADD CONSTRAINT "FK_fbcec9c4908de8338081b5bfeb0" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "properties" ADD CONSTRAINT "FK_cec911f4e8121d16a8f9a7b031f" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "units" ADD CONSTRAINT "FK_546f4aa111022d983a32103048b" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "units" ADD CONSTRAINT "FK_f0be597f225559f5550ef4d640f" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_profiles" ADD CONSTRAINT "FK_b8a59063604d0b6d659548da5a9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_profiles" ADD CONSTRAINT "FK_de6f7c888d6661227616ff312f4" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD CONSTRAINT "FK_175030e58c0d1accdb888a431d8" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD CONSTRAINT "FK_41ddb25063485103a828efc4084" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD CONSTRAINT "FK_35ba530fe49310f0dc16748b557" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD CONSTRAINT "FK_e107f3926aa0bebdde88243b5cb" FOREIGN KEY ("landlordUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD CONSTRAINT "FK_30581aa3255a616a0dd033dbc29" FOREIGN KEY ("renewedFromLeaseId") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD CONSTRAINT "FK_9db0d3ef77c565e7bf7b3a8ea7c" FOREIGN KEY ("renewedToLeaseId") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_d0e156af6bcda64dc420f44ae1c" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_98a04cdcbac4f6a2c55c7d19350" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_79fa12c269730f9e1eb40b09d3b" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_b44a43463c1f091a11f768d5389" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_invitations" ADD CONSTRAINT "FK_9955c6fc3e8c37d502265ce846d" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_invitations" ADD CONSTRAINT "FK_888027e25f3cd96aca2b013e6d3" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_invitations" ADD CONSTRAINT "FK_c8099066c8aa54ea0df9db0f9d4" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_invitations" ADD CONSTRAINT "FK_286ec915ac82dacb01b4f8aba82" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_invitations" ADD CONSTRAINT "FK_bd230c7339c22fed2aa387529ee" FOREIGN KEY ("tenantProfileId") REFERENCES "tenant_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_invitations" DROP CONSTRAINT "FK_bd230c7339c22fed2aa387529ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_invitations" DROP CONSTRAINT "FK_286ec915ac82dacb01b4f8aba82"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_invitations" DROP CONSTRAINT "FK_c8099066c8aa54ea0df9db0f9d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_invitations" DROP CONSTRAINT "FK_888027e25f3cd96aca2b013e6d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_invitations" DROP CONSTRAINT "FK_9955c6fc3e8c37d502265ce846d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_b44a43463c1f091a11f768d5389"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_79fa12c269730f9e1eb40b09d3b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_98a04cdcbac4f6a2c55c7d19350"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_d0e156af6bcda64dc420f44ae1c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" DROP CONSTRAINT "FK_9db0d3ef77c565e7bf7b3a8ea7c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" DROP CONSTRAINT "FK_30581aa3255a616a0dd033dbc29"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" DROP CONSTRAINT "FK_e107f3926aa0bebdde88243b5cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" DROP CONSTRAINT "FK_35ba530fe49310f0dc16748b557"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" DROP CONSTRAINT "FK_41ddb25063485103a828efc4084"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" DROP CONSTRAINT "FK_175030e58c0d1accdb888a431d8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_profiles" DROP CONSTRAINT "FK_de6f7c888d6661227616ff312f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_profiles" DROP CONSTRAINT "FK_b8a59063604d0b6d659548da5a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "units" DROP CONSTRAINT "FK_f0be597f225559f5550ef4d640f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "units" DROP CONSTRAINT "FK_546f4aa111022d983a32103048b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "properties" DROP CONSTRAINT "FK_cec911f4e8121d16a8f9a7b031f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_companies" DROP CONSTRAINT "FK_fbcec9c4908de8338081b5bfeb0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_companies" DROP CONSTRAINT "FK_295e2ec0606b47e50687ff46c34"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c8099066c8aa54ea0df9db0f9d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b77424e8049ff41872f6b0291a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dbb992b1e69267c7b89e45307c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bd230c7339c22fed2aa387529e"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_invitations"`);
    await queryRunner.query(
      `DROP TYPE "public"."tenant_invitations_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9955c6fc3e8c37d502265ce846"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_265e3e740b00f6ba3f5f3ccb0c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5e5340e04f80f443829089af80"`,
    );
    await queryRunner.query(`DROP TABLE "company_invitations"`);
    await queryRunner.query(
      `DROP TYPE "public"."company_invitations_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."company_invitations_role_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_79fa12c269730f9e1eb40b09d3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_98a04cdcbac4f6a2c55c7d1935"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d0e156af6bcda64dc420f44ae1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_27faf14e8959f0e40d7b722dc0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_32b41cdb985a296213e9a928b5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_39eee28b1f5056d199f4ed2c1c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d94f28cc215bf9e685c73e014b"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_paymenttype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_paymentmethod_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_41ddb25063485103a828efc408"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_175030e58c0d1accdb888a431d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_35ba530fe49310f0dc16748b55"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f04ca7b565c329d2a6f1b73c0f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_999e1e0b307266b4578e02fca5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bf00ca6c0fc2f9202dda9304ff"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3f53b37aabe10e2a1033d05b2c"`,
    );
    await queryRunner.query(`DROP TABLE "leases"`);
    await queryRunner.query(`DROP TYPE "public"."leases_leasetype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."leases_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b8a59063604d0b6d659548da5a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_de6f7c888d6661227616ff312f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9484191f37ec856d966f87c0a4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d6329fff49d3b9f3c6b1dabb06"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_profiles"`);
    await queryRunner.query(`DROP TYPE "public"."tenant_profiles_status_enum"`);
    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_546f4aa111022d983a32103048"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0be597f225559f5550ef4d640"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_37768e6e1261ee85920f8a387d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_43714c4d2bdfcca2c28fa2c4ea"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_452076bf093c729d6fcf363a9f"`,
    );
    await queryRunner.query(`DROP TABLE "units"`);
    await queryRunner.query(`DROP TYPE "public"."units_leasetype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."units_unittype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."units_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cec911f4e8121d16a8f9a7b031"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9cd2513cd04f57c9967f640b0a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b8a33773574f818b93eb6a78b4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9ea179f3777f6d78a274a3f201"`,
    );
    await queryRunner.query(`DROP TABLE "properties"`);
    await queryRunner.query(`DROP TYPE "public"."properties_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."properties_propertytype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_295e2ec0606b47e50687ff46c3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fbcec9c4908de8338081b5bfeb"`,
    );
    await queryRunner.query(`DROP TABLE "user_companies"`);
    await queryRunner.query(`DROP TYPE "public"."user_companies_role_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
