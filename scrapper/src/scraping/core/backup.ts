import fs from 'fs';

export function createBackup(filePath: string) {
    const backupPath = `${filePath}.bak-${new Date().toISOString().replace(/:/g, '-')}`;
    if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`[Backup] Created: ${backupPath}`);
    }
}
