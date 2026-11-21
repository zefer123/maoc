import { parseArgs } from 'node:util';
import { backupVault, restoreVault, verifyBackup, convertVault } from '../src/vaultMaintenance.js';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    source: { type: 'string' }, destination: { type: 'string' }, 'max-age-hours': { type: 'string' }, help: { type: 'boolean' }
  } });
  if (values.help) console.log('vault-admin.mjs <backup|restore|import-sqlite|export-json> --source <absolute path> --destination <fresh absolute path>\nStop the entire backend gracefully before operating on its Vault. No active/stale lock is removed. Parent destination directory must exist.\nvault-admin.mjs verify --source <absolute backup path> [--max-age-hours <positive integer; default 168>]\nRead-only audit of an idle backup; exit 0 fresh, 2 stale, 1 invalid/unreadable.');
  else {
    if (positionals.length !== 1) throw new Error('Exactly one maintenance command is required');
    const [command] = positionals;
    const maxAge = values['max-age-hours'];
    if (command !== 'verify' && maxAge !== undefined) throw new Error('--max-age-hours is only for verify');
    let result;
    if (command === 'verify') {
      if (values.destination !== undefined) throw new Error('verify does not accept a destination');
      if (maxAge !== undefined && !/^\d+$/.test(maxAge)) throw new Error('--max-age-hours must be a positive integer');
      result = await verifyBackup(values.source, { maxAgeHours: maxAge === undefined ? undefined : Number(maxAge) });
      if (result.freshness === 'stale') process.exitCode = 2;
    } else if (command === 'backup') result = await backupVault(values.source, values.destination);
    else if (command === 'restore') result = await restoreVault(values.source, values.destination);
    else if (command === 'import-sqlite') result = await convertVault(values.source, values.destination, 'sqlite');
    else if (command === 'export-json') result = await convertVault(values.source, values.destination, 'atomic-json');
    else throw new Error('Unknown maintenance command');
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'error', message: error.message }));
  process.exitCode = 1;
}