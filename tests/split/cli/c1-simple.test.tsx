import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const INPUT_CODE = fs.readFileSync(path.join(__dirname, 'c1-simple.in.txt'), 'utf-8')
const OUTPUT_CODE = fs.readFileSync(path.join(__dirname, 'c1-simple.out.txt'), 'utf-8')

function runCli(command: string) {
	const cliPath = path.resolve(__dirname, '../../../src/index.ts');
	return execSync(`npx tsx ${cliPath} ${command}`, { encoding: 'utf-8' });
}

function withTempFile(initialCode: string, fn: (tempFile: string) => void) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
	const tempFile = path.join(tempDir, 'App.tsx');
	fs.writeFileSync(tempFile, initialCode, 'utf-8');
	try {
		fn(tempFile);
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

describe('[cli-simple] Extract JSX Component Refactoring via CLI', () => {

	it('should extract View component', () => {
		withTempFile(INPUT_CODE, (tempFile) => {
			const start = "147:1"
			const end = "217:11"

			// Test detect
			const detectOut = runCli(`detect --file "${tempFile}" --start ${start} --end ${end}`);
			const detectData = JSON.parse(detectOut);
			expect(detectData.length).toBeGreaterThanOrEqual(1);
			console.log('Detect Output:', detectOut);

			// Test props
			const propsOut = runCli(`props --file "${tempFile}" --tag ${detectData[0].tag}`);
			expect(JSON.parse(propsOut).hasChildren).toBe(true);
			console.log('Props Output:', propsOut);

			// Test extract
			const extractOut = runCli(`extract --file "${tempFile}" --tag ${detectData[0].tag} --name TaskDetailsPageView`);
			expect(JSON.parse(extractOut).success).toBe(true);

			// const modifiedCode = fs.readFileSync(tempFile, 'utf-8');
			// expect(modifiedCode.trim()).toBe(OUTPUT_CODE.trim());
		});
	});
});
