import { expect } from 'vitest';
import { test } from './test-utils';
import { runCliRefactor } from '../src/refactor';

test('Scenario 7: Generics Hoisting', async ({ testProjectDir }) => {
  const result = await runCliRefactor('src/components/GenericTable.tsx', { cwd: testProjectDir });

  const files = result.fs.glob('src/components/GenericTable/molecules/**/*.tsx');
  const rowMoleculePath = files.find(f => result.fs.read(f).includes('<tr'));
  if (!rowMoleculePath) throw new Error('Row molecule not found');

  const moleculeCode = result.fs.read(rowMoleculePath);
  
  // Expect generic type constraint to be hoisted
  expect(moleculeCode).toMatch(/export function \w+<T extends \{ id: string \}>/);
  expect(moleculeCode).toMatch(/interface \w+Props<T extends \{ id: string \}>/);
  expect(moleculeCode).toContain('item: T');
});
