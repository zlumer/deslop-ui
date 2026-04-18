import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { applyTextChanges } from '../../src/extract/applyTextChanges';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';

function prepareTS(inputCode: string)
{
	const fileName = 'App.tsx';
	const compilerOptions: ts.CompilerOptions = {
		target: ts.ScriptTarget.Latest,
		jsx: ts.JsxEmit.React,
		module: ts.ModuleKind.CommonJS
	};

	const host = ts.createCompilerHost(compilerOptions);
	const originalGetSourceFile = host.getSourceFile;

	// Intercept filesystem calls to serve our in-memory code
	host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
	{
		if (name === fileName)
		{
			return ts.createSourceFile(fileName, inputCode, languageVersion, true, ts.ScriptKind.TSX);
		}
		return originalGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
	};

	const program = ts.createProgram([fileName], compilerOptions, host);
	const typeChecker = program.getTypeChecker();
	const sourceFile = program.getSourceFile(fileName);

	if (!sourceFile)
	{
		throw new Error("Failed to generate SourceFile");
	}
	return { sourceFile, typeChecker };
}

const INPUT_CODE = `export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<button className="btn-primary">Submit Form</button>
		</div>
	)
}`;

const EXPECTED_CODE = `const SubmitButton = () => <button className="btn-primary">Submit Form</button>;

export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<SubmitButton />
		</div>
	)
}`;

describe('[1-simple] Extract JSX Component Refactoring', () =>
{
	it('should successfully detect a <button> as an extraction candidate', () =>
	{
		const { sourceFile, typeChecker } = prepareTS(INPUT_CODE);

		const buttonStart = INPUT_CODE.lastIndexOf('<button');
		const buttonEnd = INPUT_CODE.indexOf('</button>') + '</button>'.length;
		const selection = { start: buttonStart, end: buttonEnd };

		const candidates = detectComponents(sourceFile, selection)

		expect(candidates.length).toBeGreaterThanOrEqual(1);
		expect(candidates[0].node.kind).toBe(ts.SyntaxKind.JsxElement);
		expect(candidates[0].description).toContain('<button');
	})
	it('should successfully extract a <button> into a SubmitButton component', () =>
	{
		// -------------------------------------------------------------------
		// SETUP: Define inputs, outputs, and create a TS Program
		// -------------------------------------------------------------------

		// Set up an in-memory TypeScript program to get AST and TypeChecker
		const { sourceFile, typeChecker } = prepareTS(INPUT_CODE);

		// Find the text offsets for: <button className="btn-primary">Submit Form</button>
		const buttonStart = INPUT_CODE.lastIndexOf('<button');
		const buttonEnd = INPUT_CODE.indexOf('</button>') + '</button>'.length;
		const selection = { start: buttonStart, end: buttonEnd };


		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection)
		console.log('Detected Candidates:', candidates.map(c => c.description));

		// Assertions for Step 1
		expect(candidates.length).toBeGreaterThanOrEqual(1);
		expect(candidates[0].node.kind).toBe(ts.SyntaxKind.JsxElement);
		expect(candidates[0].description).toContain('<button');


		// -------------------------------------------------------------------
		// STEP 2: Detect Props and Context
		// -------------------------------------------------------------------
		const decisionsRequest = detectPropsList(
			sourceFile,
			typeChecker,
			candidates[0]
		);

		// Assertions for Step 2
		// Since the <button> uses no external variables from App(), props should be empty
		expect(decisionsRequest.props).toHaveLength(0);
		// It has a text child: "Submit Form"
		expect(decisionsRequest.hasChildren).toBe(true);
		expect(decisionsRequest.childrenNodes.length).toBe(1);
		expect(decisionsRequest.childrenNodes[0].kind).toBe(ts.SyntaxKind.JsxText);


		// -------------------------------------------------------------------
		// STEP 3: Perform Refactor
		// -------------------------------------------------------------------
		const decisions = {
			componentName: 'SubmitButton',
			extractChildren: true, // User decides to hardcode "Submit Form" into the new component
			selectedProps: []      // No props to pass
		} satisfies RefactorDecisions

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		)

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const SubmitButton = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxSelfClosingElement); // <SubmitButton />

		// Apply TextChanges to the original string to verify the final output
		const finalSourceCode = applyTextChanges(INPUT_CODE, result.textChanges);
		expect(finalSourceCode).toBe(EXPECTED_CODE);
	});
});
