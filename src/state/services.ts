import { loadConfig, type AppConfig } from '../config';
import { createRepository, type Repository } from '../data/repository';
import { createAuthClient, type AuthClient } from '../google/auth';
import { createDrive, type Drive } from '../google/drive';
import { createHttp } from '../google/http';
import { createSheets, type Sheets } from '../google/sheets';

export interface Services {
  config: AppConfig;
  auth: AuthClient;
  drive: Drive;
  sheets: Sheets;
  repo: Repository;
}

export async function createServices(): Promise<Services> {
  const config = loadConfig();
  const auth = await createAuthClient(config.clientId);
  const http = createHttp(auth);
  const sheets = createSheets(http);
  return { config, auth, drive: createDrive(http), sheets, repo: createRepository(sheets) };
}
