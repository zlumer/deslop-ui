import { it, expect } from 'vitest';
import { runCliRefactor } from '../src/refactor';

it('Scenario 7: Generics Hoisting', async () => {
  const result = await runCliRefactor('src/components/GenericTable.tsx');

  const files = result.fs.glob('src/components/GenericTable/molecules/**/*.tsx');
  const rowMoleculePath = files.find(f => result.fs.read(f).includes('<tr'));
  if (!rowMoleculePath) throw new Error('Row molecule not found');

  const moleculeCode = result.fs.read(rowMoleculePath);
  
  // Expect generic type constraint to be hoisted
  expect(moleculeCode).toMatch(/export function \w+<T extends \{ id: string \}>/);
  expect(moleculeCode).toMatch(/interface \w+Props<T extends \{ id: string \}>/);
  expect(moleculeCode).toContain('item: T');
});
