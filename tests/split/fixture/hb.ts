import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const PINNED_COMMIT = '27fbc07f90d69c1b6067a534034ff06b1e4f84c8'; 
const REPO_URL = 'https://github.com/zlumer/hyperbranch.git';

export function setupHyperbranchFixture(): string {
    // 1. Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hyperbranch-fixture-'));
    const frontendDir = path.join(tempDir, 'frontend');

    console.log(`[Fixture] Setting up in ${tempDir}`);

    try {
        // 2. Clone the repository and checkout the pinned commit
        execSync(`git clone ${REPO_URL} .`, { cwd: tempDir, stdio: 'inherit' });
        execSync(`git checkout ${PINNED_COMMIT}`, { cwd: tempDir, stdio: 'inherit' });

        if (!fs.existsSync(frontendDir)) {
            throw new Error(`Frontend directory not found at ${frontendDir}`);
        }

        // 3. Install dependencies
        console.log('[Fixture] Installing dependencies...');
        execSync('npm i', { cwd: frontendDir, stdio: 'inherit' });

        // 4. Verify build without emitting files
        console.log('[Fixture] Verifying build...');
        execSync('npx tsc -b --noEmit', { cwd: frontendDir, stdio: 'inherit' });

        console.log('[Fixture] Setup complete.');
        return frontendDir;
        
    } catch (error) {
        console.error('[Fixture] Failed to setup Hyperbranch fixture:', error);
        throw error;
    }
}

export function cleanupHyperbranchFixture(tempDir: string) {
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
