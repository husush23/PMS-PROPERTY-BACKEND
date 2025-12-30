import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is not set. Please ensure it is defined in your .env file.',
  );
}

// Parse DATABASE_URL to extract connection parameters
// This avoids TypeORM's strict URL parsing that fails with special characters
function parseDatabaseUrl(databaseUrl: string) {
  try {
    // Use URL constructor to parse, but extract components manually
    const url = new URL(databaseUrl);
    
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      username: url.username,
      password: url.password, // This handles decoding automatically
      database: url.pathname.slice(1), // Remove leading '/'
    };
  } catch (error) {
    throw new Error(
      `Failed to parse DATABASE_URL: ${error.message}\n` +
        `Please ensure your connection string follows the format: postgresql://user:password@host:port/database`,
    );
  }
}

const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      ssl: { rejectUnauthorized: false },
      autoLoadEntities: true,
      synchronize: false,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}


