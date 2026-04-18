import { expect } from 'vitest';
import { test } from './test-utils';
import { runCliRefactor } from '../../src/refactor';

test('Scenario 2: Deduplication via Structural Hashing', async ({ testProjectDir }) => {
  const result = await runCliRefactor('src/components/ConfirmDialog.tsx', { cwd: testProjectDir });

  // 1. Verify only ONE button atom was created
  const atomFiles = result.fs.glob('src/components/ConfirmDialog/atoms/**/*.tsx');
  const buttonAtoms = atomFiles.filter(f => result.fs.read(f).includes('<button'));
  expect(buttonAtoms.length).toBe(1); // Fails if AI naive extraction made 2 files

  const buttonCode = result.fs.read(buttonAtoms[0]);
  
  // 2. Verify dynamic props were extracted into the Atom interface
  expect(buttonCode).toMatch(/interface \w+Props/);
  expect(buttonCode).toContain('children: React.ReactNode'); // For 'Submit' / 'Cancel'
  expect(buttonCode).toContain('onClick: () => void'); // The specific handler

  // 3. Verify Glue component uses the deduplicated atom twice
  const glueCode = result.fs.read('src/components/ConfirmDialog/ConfirmDialog.tsx');
  
  // Use Regex to find the generated button component name, or just count <AiGeneratedName
  // We can find the component name from the buttonAtoms[0] filename
  const componentNameMatch = buttonCode.match(/export const (\w+)/);
  expect(componentNameMatch).toBeTruthy(); // Ensure we found the component name
  const componentName = componentNameMatch![1];
  
  const buttonTags = glueCode.match(new RegExp(`<${componentName}`, 'g'));
  expect(buttonTags?.length).toBe(2);
});
