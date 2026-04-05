import { expect } from 'vitest';
import { test } from './test-utils';
import { runCliRefactor } from '../src/refactor';
import { runVisualRegression } from '../src/visual-regression';
import path from 'path';

test('Scenario 1: Happy Path Extraction (Content-Based Assertions)', async ({ testProjectDir }) =>
{
	// 1. Run the CLI against the target monolith
	const result = await runCliRefactor('src/components/UserCard.tsx', {
		cwd: testProjectDir
	});

	// --- HELPER FUNCTION ---
	// Searches recursively through a directory to find a component by its JSX footprint
	const findComponentByContent = (subDir: string, searchString: string) =>
	{
		const files = result.fs.glob(`src/components/UserCard/${subDir}/**/*.tsx`);
		for (const file of files)
		{
			const content = result.fs.read(file);
			if (content.includes(searchString))
			{
				return {
					name: path.basename(file, '.tsx'), // e.g., 'Avatar' or 'ProfileImg'
					filePath: file,
					content
				};
			}
		}
		throw new Error(`Could not find any component in ${subDir} containing "${searchString}"`);
	};

	// 2. Check Deterministic Files 
	// (The barrel file and top-level Glue component names are derived from the input file, so they are safe to hardcode)
	expect(result.fs.exists('src/components/UserCard/index.ts')).toBe(true);
	expect(result.fs.read('src/components/UserCard/index.ts'))
		.toContain("export { UserCard } from './UserCard'");

	const glueCode = result.fs.read('src/components/UserCard/UserCard.tsx');

	// 3. Find and Verify Atoms dynamically via JSX footprints
	const imageAtom = findComponentByContent('atoms', '<img');
	const titleAtom = findComponentByContent('atoms', '<h2');
	const buttonAtom = findComponentByContent('atoms', '<button');

	// Verify the AST correctly hoisted variables into TS interfaces for the Button
	expect(buttonAtom.content).toMatch(/interface \w+Props/);
	expect(buttonAtom.content).toContain('onClick:'); // Ensures event handler was typed
	expect(buttonAtom.content).toContain('onClick={'); // Ensures it was wired to the DOM

	// 4. Verify Molecule/Organism Composition
	// We don't know if the AI created a Molecule or just put them straight into the Glue file.
	// But we DO know that *some* parent component must import the generated Button Atom.
	const allRefactoredFiles = result.fs.glob('src/components/UserCard/**/*.tsx');

	const fileImportingButton = allRefactoredFiles.find(file =>
	{
		const content = result.fs.read(file);
		// Looking for: import { AiGeneratedName } from '...'
		return content.includes(`import { ${buttonAtom.name} }`) && file !== buttonAtom.filePath;
	});

	expect(fileImportingButton).toBeDefined();

	// 5. Verify the Glue Component's Prop Drilling
	// The original UserCard accepted `avatarUrl`, `name`, `role`, and `onProfileClick`.
	// The refactored Glue component MUST still accept these exact same props.
	expect(glueCode).toContain('export interface UserCardProps');
	expect(glueCode).toContain('avatarUrl: string');
	expect(glueCode).toContain('onProfileClick: () => void');

	// And it must be passing them down to *something*
	expect(glueCode).toContain('avatarUrl={avatarUrl}');
	expect(glueCode).toContain('onProfileClick={onProfileClick}');

	// 6. Visual Regression (The ultimate deterministic check)
	// Even if the AST generated 5 atoms and 2 molecules, the rendered pixels must be 100% identical
	const diffPercentage = await runVisualRegression('UserCard');
	expect(diffPercentage).toBe(0);
});