import { expect } from 'vitest';
import { test } from './test-utils';
import { runCliRefactor } from '../../src/refactor';

test('Scenario 3: Hook Purity Sorting', async ({ testProjectDir }) => {
  const result = await runCliRefactor('tests/test-project/src/components/DashboardWidget.tsx', { cwd: testProjectDir });

  const glueCode = result.fs.read('tests/test-project/src/components/DashboardWidget/DashboardWidget.tsx');
  
  // Find the molecule that uses the theme and translation
  const molecules = result.fs.glob('tests/test-project/src/components/DashboardWidget/molecules/**/*.tsx');
  const moleculeCode = molecules.length > 0 ? result.fs.read(molecules[0]) : '';

  // 1. Verify impure hook stays in Glue
  expect(glueCode).toContain('useFetchUsers');
  expect(moleculeCode).not.toContain('useFetchUsers');

  // 2. Verify pure hooks were moved/copied DOWN to the UI components that need them
  // (Either in the glue component if it kept some parts, or in the extracted molecules)
  const allRefactoredCode = result.fs.glob('tests/test-project/src/components/DashboardWidget/**/*.tsx').map(f => result.fs.read(f)).join('\n');
  expect(allRefactoredCode).toContain('useTranslation');
  expect(allRefactoredCode).toContain('useTheme');

  // 3. Ensure pure hooks are NOT passed as props from the Glue component (preventing prop drilling)
  expect(glueCode).not.toMatch(/t=\{[a-zA-Z]+\}/);
  expect(glueCode).not.toMatch(/theme=\{[a-zA-Z]+\}/);
});
