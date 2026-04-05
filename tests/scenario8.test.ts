import { it, expect } from 'vitest';
import { runCliRefactor } from '../src/refactor';

it('Scenario 8: The Guard Clause (Leaf Nodes & Multiple Returns)', async () => {
  const result = await runCliRefactor('src/components/GuardedComponent.tsx');

  const glueCode = result.fs.read('src/components/GuardedComponent/GuardedComponent.tsx');

  // Assert Guard Clauses are untouched
  expect(glueCode).toContain('if (error) return <ErrorState />;');
  expect(glueCode).toContain('if (loading) return <Spinner />;');

  // Assert Main Content is refactored (e.g. extracted layout or organism)
  expect(glueCode).not.toContain('<div className="layout bg-white p-6 shadow rounded">');
  // It should be replaced by a Layout or Organism
  expect(glueCode).toMatch(/<[A-Z][a-zA-Z]+/);
});
