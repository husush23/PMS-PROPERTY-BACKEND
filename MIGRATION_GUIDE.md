# Database Migrations Guide

This project uses TypeORM migrations for database schema management. Migrations allow you to version control your database schema and apply changes safely in production.

## Setup

The migration configuration is in `src/database/data-source.ts`. This file uses the `DATABASE_URL` environment variable from your `.env` file.

## Migration Commands

### Generate a new migration

Generate a migration based on changes to your entities:

```bash
npm run migration:generate src/database/migrations/MigrationName
```

**Example:**
```bash
npm run migration:generate src/database/migrations/AddEmailToUsers
```

This will compare your entities with the current database state and generate a migration file with the necessary SQL changes.

### Create an empty migration

Create an empty migration file for manual SQL:

```bash
npm run migration:create src/database/migrations/MigrationName
```

**Example:**
```bash
npm run migration:create src/database/migrations/CustomDataMigration
```

### Run pending migrations

Apply all pending migrations to the database:

```bash
npm run migration:run
```

### Revert the last migration

Revert the most recently run migration:

```bash
npm run migration:revert
```

### Show migration status

Check which migrations have been run:

```bash
npm run migration:show
```

## Initial Setup

To create the initial migration for your existing entities:

1. Make sure your `.env` file has `DATABASE_URL` set correctly
2. Generate the initial migration:
   ```bash
   npm run migration:generate src/database/migrations/InitialSchema
   ```
3. Review the generated migration file to ensure it's correct
4. Run the migration:
   ```bash
   npm run migration:run
   ```

## Production Deployment

Before deploying to production:

1. **Always test migrations locally first** on a copy of production data
2. **Backup your database** before running migrations in production
3. Run migrations as part of your deployment process:
   ```bash
   npm run migration:run
   ```

## Important Notes

- **Never edit generated migrations** after they've been run in production
- **Always create new migrations** for schema changes
- The `synchronize: false` setting ensures TypeORM never auto-syncs the schema in production
- Migrations are tracked in a `migrations` table created automatically by TypeORM

## Troubleshooting

If you encounter issues:

1. Check that `DATABASE_URL` is set correctly in your `.env` file
2. Verify your database connection is working
3. Check the migration files for syntax errors
4. Use `migration:show` to see the current state


