import { expect } from 'vitest';
import { test } from './test-utils';
import { runCliRefactor } from '../../src/refactor';

test('Scenario 6: The innerRef Bypass', async ({ testProjectDir }) => {
  const result = await runCliRefactor('src/components/SearchInput.tsx', { cwd: testProjectDir });

  const files = result.fs.glob('src/components/SearchInput/atoms/**/*.tsx');
  const inputAtomPath = files.find(f => result.fs.read(f).includes('<input'));
  if (!inputAtomPath) throw new Error('Input atom not found');

  const atomCode = result.fs.read(inputAtomPath);
  
  // Expect the atom to use innerRef instead of ref for the prop type
  expect(atomCode).toContain('innerRef: React.RefObject<HTMLInputElement>');
  expect(atomCode).toContain('ref={innerRef}');

  const glueCode = result.fs.read('src/components/SearchInput/SearchInput.tsx');
  
  // Expect Glue to pass searchInputRef to innerRef prop
  expect(glueCode).toContain('innerRef={searchInputRef}');
});
