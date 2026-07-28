import { electronDatabase, hasElectronDatabaseBridge } from './electron';
import type { DatabaseService } from './types';
import { webDatabase } from './web';

const db: DatabaseService = hasElectronDatabaseBridge() ? electronDatabase : webDatabase;

export type {
  CustomSymbolRepository,
  CustomSymbolRow,
  DatabaseService,
  DevicePointImportRow,
  DevicePointRow,
  DeviceTemplateRepository,
  DeviceTypeRow,
  McuRepository,
  PointInsertRow,
  PointRepository,
  PointRow,
  ProjectRepository,
  StationRepository,
  TemplateRepository
} from './types';

export default db;
