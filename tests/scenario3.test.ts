import { it, expect } from 'vitest';
import { runCliRefactor } from '../src/refactor';

it('Scenario 3: Hook Purity Sorting', async () => {
  const result = await runCliRefactor('src/components/DashboardWidget.tsx');

  const glueCode = result.fs.read('src/components/DashboardWidget/DashboardWidget.tsx');
  const moleculeCode = result.fs.read('src/components/DashboardWidget/molecules/WidgetHeader.tsx'); // Assuming AI named it this

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
  expect(glueCode).toContain('onToggle={() => setExpanded(!expanded)}');
  
  // 5. Verify the early return (leaf node) was NOT extracted
  expect(glueCode).toContain('if (loading) return <div');
});