import { describe, expect } from 'vitest';
import * as ts from 'typescript';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';
import { sft } from './utils';

const INPUT_CODE = `export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<button className="btn-primary">Submit Form</button>
		</div>
	)
}`;

const BUTTON_WITH_TEXT = `const SubmitButton = () => <button className="btn-primary">Submit Form</button>;

export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<SubmitButton />
		</div>
	)
}`

describe('[1-simple] Extract JSX Component Refactoring', () =>
{
	sft('should successfully extract a <button> into a SubmitButton component', INPUT_CODE, BUTTON_WITH_TEXT, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) =>
	{
		// Find the text offsets for: <button className="btn-primary">Submit Form</button>
		const buttonStart = inputCode.lastIndexOf('<button');
		const buttonEnd = inputCode.indexOf('</button>') + '</button>'.length;
		const selection = { start: buttonStart, end: buttonEnd };


		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection)
		// console.log('Detected Candidates:', candidates.map(c => c.description));

		// Assertions for Step 1
		expect(candidates.length).toBeGreaterThanOrEqual(1);
		const buttonCandidate = candidates.find(c => c.description.includes('<button'))!;
		expect(buttonCandidate).toBeDefined();
		expect(buttonCandidate.node.kind).toBe(ts.SyntaxKind.JsxElement);
		expect(buttonCandidate.description).toContain('<button');


		// -------------------------------------------------------------------
		// STEP 2: Detect Props and Context
		// -------------------------------------------------------------------
		const decisionsRequest = detectPropsList(
			sourceFile,
			typeChecker,
			buttonCandidate
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

		return result
	});
});
