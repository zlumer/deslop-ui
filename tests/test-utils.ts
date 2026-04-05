import { test as base } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface CliTestContext {
  testProjectDir: string;
}

export const test = base.extend<CliTestContext>({
  testProjectDir: async ({}, use) => {
    const tmpPrefix = path.join(os.tmpdir(), 'ui-ai-test-');
    const tmpDir = await fs.mkdtemp(tmpPrefix);
    
    const templateDir = path.resolve(__dirname, './test-project');
    
    await fs.cp(templateDir, tmpDir, { recursive: true });

    await use(tmpDir);

    await fs.rm(tmpDir, { recursive: true, force: true });
  },
});
