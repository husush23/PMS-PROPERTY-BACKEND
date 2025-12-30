import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

// Parse DATABASE_URL
function parseDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  
  return {
    host: url.hostname,
    port: parseInt(url.port || '5432', 10),
    username: url.username,
    password: url.password,
    database: url.pathname.slice(1),
  };
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);

export default new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  ssl: { rejectUnauthorized: false },
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

