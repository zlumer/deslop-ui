import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/SloppyComponent.tsx');
const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TEST_TIMEOUT = 120_000;

describe('[auto] End-to-end auto refactoring via AI CLI', () => {
	let tmpDir: string;
	let tmpFile: string;
	let originalContent: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deslop-auto-'));
		tmpFile = path.join(tmpDir, 'SloppyComponent.tsx');
		fs.copyFileSync(FIXTURE_PATH, tmpFile);
		originalContent = fs.readFileSync(tmpFile, 'utf-8');
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it('should refactor a sloppy component into atoms and views', () => {
		const promptFile = path.join(tmpDir, 'deslop-prompt.txt');

		const result = spawnSync('npx', [
			'tsx', CLI_PATH, 'auto', tmpFile,
			'--ai-command', `aider --yes --no-auto-commit --message`,
		], {
			encoding: 'utf-8',
			timeout: TEST_TIMEOUT,
			cwd: PROJECT_ROOT,
		});

		// 1. Process exited cleanly
		expect(result.status, `CLI failed (exit ${result.status}):\n${result.stderr}`).toBe(0);

		// 2. Fixture was refactored with atomic imports
		const refactored = fs.readFileSync(tmpFile, 'utf-8');
		expect(refactored).toMatch(/\/atoms\/|\/views\//);

		// 3. Console output contains a JSON summary
		expect(result.stdout).toBeTruthy();
		const summary = JSON.parse(result.stdout);
		expect(summary).toHaveProperty('atomsCreated');
		expect(summary).toHaveProperty('viewsCreated');

		// 4. Backup preserves the original source
		const bakFile = tmpFile + '.bak';
		expect(fs.existsSync(bakFile), 'Expected .bak backup file').toBe(true);
		expect(fs.readFileSync(bakFile, 'utf-8')).toBe(originalContent);
	}, TEST_TIMEOUT);
});
