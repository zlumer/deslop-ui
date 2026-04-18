import { expect } from 'vitest';
import { test } from './test-utils';
import { runCliRefactor } from '../../src/refactor';

test('Scenario 4: Inline State Mutation Hoisting', async ({ testProjectDir }) => {
  const result = await runCliRefactor('src/components/ToggleWidget.tsx', { cwd: testProjectDir });

  const files = result.fs.glob('src/components/ToggleWidget/atoms/**/*.tsx');
  const buttonAtomPath = files.find(f => result.fs.read(f).includes('<button'));
  if (!buttonAtomPath) throw new Error('Button atom not found');

  const atomCode = result.fs.read(buttonAtomPath);
  const glueCode = result.fs.read('src/components/ToggleWidget/ToggleWidget.tsx');

  // Assert Atom interface extracted the inline function as a correctly typed prop
  expect(atomCode).toMatch(/interface \w+Props/);
  // Verify it types the callback property as returning void
  expect(atomCode).toMatch(/\w+: \(\) => void/); 
  
  // Assert Glue component hoists the inline mutation and passes it as a prop
  expect(glueCode).toContain('() => setExpanded(!expanded)');
  expect(glueCode).toMatch(/<[a-zA-Z]+ .*=\{\(\) => setExpanded\(!expanded\)\}/);
});
