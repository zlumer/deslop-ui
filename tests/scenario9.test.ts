import { it, expect, vi } from 'vitest';
import { runCliRefactor } from '../src/refactor';
import * as visualRegression from '../src/visual-regression';

vi.mock('../src/visual-regression');

it('Scenario 9: Visual Regression Catch (Intentional Failure)', async () => {
  // Mock visual regression to return a 5% difference
  vi.mocked(visualRegression.runVisualRegression).mockResolvedValue({
    diffPercentage: 5.0,
    passed: false,
    diffImageBase64: 'mock-base64',
  });

  const result = await runCliRefactor('src/components/FlexLayout.tsx');

  // Asserts
  expect(result.success).toBe(false);
  
  // Original file should still exist
  expect(result.fs.exists('src/components/FlexLayout.tsx')).toBe(true);
  
  // Refactored folder should NOT exist (rolled back)
  expect(result.fs.exists('src/components/FlexLayout')).toBe(false);
  
  // Tmp dir should NOT exist (rolled back)
  expect(result.fs.exists('src/components/.tmp-FlexLayout')).toBe(false);

  expect(result.warnings.some(w => w.includes('Visual regression failed') || w.toLowerCase().includes('visual'))).toBe(true);
});
