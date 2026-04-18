import { expect } from 'vitest';
import { test } from './test-utils';
import { runCliRefactor } from '../../src/refactor';

test('Scenario 5: The Slot Pattern / Layout Extraction', async ({ testProjectDir }) => {
  const result = await runCliRefactor('src/components/DashboardPage.tsx', { cwd: testProjectDir });

  const layoutFiles = result.fs.glob('src/components/DashboardPage/layouts/**/*.tsx');
  expect(layoutFiles.length).toBeGreaterThan(0);
  
  const layoutPath = layoutFiles.find(f => f.includes('DashboardLayout'));
  if (!layoutPath) throw new Error('DashboardLayout not found');

  const layoutCode = result.fs.read(layoutPath);
  
  // Expect Layout to define slots
  expect(layoutCode).toContain('navSlot: React.ReactNode');
  expect(layoutCode).toContain('mainSlot: React.ReactNode');

  const glueCode = result.fs.read('src/components/DashboardPage/DashboardPage.tsx');
  
  // Expect Glue to pass organisms into the Layout's slots
  expect(glueCode).toContain('navSlot={<');
  expect(glueCode).toContain('mainSlot={<');
});
