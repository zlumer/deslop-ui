import { it, expect } from 'vitest';
import { runCliRefactor } from '../src/refactor';

it('Scenario 6: The innerRef Bypass', async () => {
  const result = await runCliRefactor('src/components/SearchInput.tsx');

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
