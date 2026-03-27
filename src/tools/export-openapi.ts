/**
 * Run after build: `npm run build && npm run openapi:export`
 * Writes openapi/openapi.json for frontend codegen (e.g. openapi-typescript).
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from '../openapi/swagger-document';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = createOpenApiDocument(app);
  const outDir = path.join(process.cwd(), 'openapi');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'openapi.json');
  fs.writeFileSync(outFile, JSON.stringify(document, null, 2), 'utf8');
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outFile}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
