import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const INPUT_CODE = `export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<button className="btn-primary">Submit Form</button>
		</div>
	)
}`;

const BUTTON_WITH_TEXT = `const SubmitButton: React.FC = () => <button className="btn-primary">Submit Form</button>;

export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<SubmitButton />
		</div>
	)
}`;

const BUTTON_NO_TEXT = `const SubmitButton: React.FC<React.PropsWithChildren> = ({ children }) => <button className="btn-primary">{children}</button>;

export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<SubmitButton>Submit Form</SubmitButton>
		</div>
	)
}`;

const H1_WTEXT = `const Heading: React.FC = () => <h1>Welcome</h1>;

export const App = () => {
	return (
		<div>
			<Heading />
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<button className="btn-primary">Submit Form</button>
		</div>
	)
}`;

const H1_NOTEXT = `const Heading: React.FC<React.PropsWithChildren> = ({ children }) => <h1>{children}</h1>;

export const App = () => {
	return (
		<div>
			<Heading>Welcome</Heading>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<button className="btn-primary">Submit Form</button>
		</div>
	)
}`;

describe('[cli-simple] Extract JSX Component Refactoring via CLI', () => {
	function runCli(command: string) {
		const cliPath = path.resolve(__dirname, '../../src/index.ts');
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

	it('should extract <button> into SubmitButton', () => {
		withTempFile(INPUT_CODE, (tempFile) => {
			const start = INPUT_CODE.lastIndexOf('<button');
			const end = INPUT_CODE.indexOf('</button>') + '</button>'.length;

			// Test detect
			const detectOut = runCli(`detect --file "${tempFile}" --start ${start} --end ${end}`);
			expect(JSON.parse(detectOut).length).toBeGreaterThanOrEqual(1);

			// Test props
			const propsOut = runCli(`props --file "${tempFile}" --start ${start} --end ${end}`);
			expect(JSON.parse(propsOut).hasChildren).toBe(true);

			// Test extract
			const extractOut = runCli(`extract --file "${tempFile}" --start ${start} --end ${end} --name SubmitButton`);
			expect(JSON.parse(extractOut).success).toBe(true);

			const modifiedCode = fs.readFileSync(tempFile, 'utf-8');
			expect(modifiedCode.trim()).toBe(BUTTON_WITH_TEXT.trim());
		});
	});

	it('should extract <button> into SubmitButton (with children)', () => {
		withTempFile(INPUT_CODE, (tempFile) => {
			const start = INPUT_CODE.lastIndexOf('<button');
			const end = INPUT_CODE.indexOf('</button>') + '</button>'.length;

			const extractOut = runCli(`extract --file "${tempFile}" --start ${start} --end ${end} --name SubmitButton --extract-children`);
			expect(JSON.parse(extractOut).success).toBe(true);

			const modifiedCode = fs.readFileSync(tempFile, 'utf-8');
			expect(modifiedCode.trim()).toBe(BUTTON_NO_TEXT.trim());
		});
	});

	it('should extract <h1> into Heading (with children)', () => {
		withTempFile(INPUT_CODE, (tempFile) => {
			const start = INPUT_CODE.lastIndexOf('<h1');
			const end = INPUT_CODE.indexOf('</h1>') + '</h1>'.length;

			const extractOut = runCli(`extract --file "${tempFile}" --start ${start} --end ${end} --name Heading --extract-children`);
			expect(JSON.parse(extractOut).success).toBe(true);

			const modifiedCode = fs.readFileSync(tempFile, 'utf-8');
			expect(modifiedCode.trim()).toBe(H1_NOTEXT.trim());
		});
	});

	it('should extract <h1> into Heading', () => {
		withTempFile(INPUT_CODE, (tempFile) => {
			const start = INPUT_CODE.lastIndexOf('<h1');
			const end = INPUT_CODE.indexOf('</h1>') + '</h1>'.length;

			const extractOut = runCli(`extract --file "${tempFile}" --start ${start} --end ${end} --name Heading`);
			expect(JSON.parse(extractOut).success).toBe(true);

			const modifiedCode = fs.readFileSync(tempFile, 'utf-8');
			expect(modifiedCode.trim()).toBe(H1_WTEXT.trim());
		});
	});
});
