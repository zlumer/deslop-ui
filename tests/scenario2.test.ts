import { it, expect } from 'vitest';
import { runCliRefactor } from '../src/refactor';


it('Scenario 2: Deduplication via Structural Hashing', async () => {
  const result = await runCliRefactor('src/components/ConfirmDialog.tsx');

  // 1. Verify only ONE button atom was created
  const atomFiles = result.fs.listDir('src/components/ConfirmDialog/atoms');
  const buttonAtoms = atomFiles.filter(f => f.includes('Button'));
  expect(buttonAtoms.length).toBe(1); // Fails if AI naive extraction made 2 files

  const buttonCode = result.fs.read(`src/components/ConfirmDialog/atoms/${buttonAtoms[0]}`);
  
  // 2. Verify dynamic props were extracted into the Atom interface
  expect(buttonCode).toContain('interface');
  expect(buttonCode).toContain('children: React.ReactNode');
  expect(buttonCode).toContain('onClick: () => void');
  expect(buttonCode).toContain('className?: string'); // For the specific bg colors

  // 3. Verify Glue component uses the deduplicated atom twice
  const glueCode = result.fs.read('src/components/ConfirmDialog/ConfirmDialog.tsx');
  const buttonImports = countOccurrences(glueCode, `<BaseButton`);
  expect(buttonImports).toBe(2);
});