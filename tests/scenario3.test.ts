import { it, expect } from 'vitest';
import { runCliRefactor } from '../src/refactor';

it('Scenario 3: Hook Purity Sorting (Non-Deterministic Safe)', async () => {
  const result = await runCliRefactor('tests/test-project/src/components/DashboardWidget.tsx');

  // Helper function to find a file by what it renders, rather than its name
  const getMoleculeCode = (contentSnippet: string) => {
    const files = result.fs.listDir('tests/test-project/src/components/DashboardWidget/molecules');
    for (const file of files) {
      const content = result.fs.read(`tests/test-project/src/components/DashboardWidget/molecules/${file}`);
      if (content.includes(contentSnippet)) return { name: file.replace('.tsx', ''), content };
    }
    throw new Error(`Could not find a molecule containing: ${contentSnippet}`);
  };

  const glueCode = result.fs.read('tests/test-project/src/components/DashboardWidget/DashboardWidget.tsx');
  
  // Find the header molecule based on its content footprint (e.g., it renders an <h3> tag)
  const headerMolecule = getMoleculeCode('<h3');
  const moleculeCode = headerMolecule.content;

  // 1. Verify impure hook stays in Glue
  expect(glueCode).toContain('useFetchMetrics');
  expect(moleculeCode).not.toContain('useFetchMetrics');

  // 2. Verify pure hooks were moved/copied DOWN to the UI components that need them
  expect(moleculeCode).toContain('useTranslation');
  expect(moleculeCode).toContain('useTheme');
  expect(moleculeCode).toContain('t(');
  expect(moleculeCode).toContain('theme ===');

  // 3. Verify pure hooks are NOT passed as props (preventing prop drilling for context)
  expect(moleculeCode).not.toContain('t: (key: string) => string');
  expect(glueCode).not.toContain('t={t}');
  expect(glueCode).not.toContain('theme={theme}');

  // 4. Verify Local State remains in Glue but updates correctly via props
  expect(glueCode).toContain('useState(false)');
  expect(glueCode).toContain('expanded={expanded}');
  
  // 5. Verify the early return (leaf node) was NOT extracted
  expect(glueCode).toContain('if (loading) return <div');
});
