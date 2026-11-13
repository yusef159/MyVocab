// Loaded before test modules so imports can never open the personal database.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'myvocab-test-')), 'test.db');
