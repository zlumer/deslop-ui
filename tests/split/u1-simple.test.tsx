import { describe, expect } from 'vitest';
import * as ts from 'typescript';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';
import { sft } from './utils';
import { applyTextChanges } from '../../src/extract/applyTextChanges';

const INPUT_CODE = `export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<button className="btn-primary">Submit Form</button>
		</div>
	)
}`;

const BUTTON_WITH_TEXT = `const SubmitButton: React.FC = () => <button className="btn-primary">Submit Form</button>;

export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<SubmitButton />
		</div>
	)
}`

const BUTTON_NO_TEXT = `const SubmitButton: React.FC<React.PropsWithChildren> = ({ children }) => <button className="btn-primary">{children}</button>;

export const App = () => {
	return (
		<div>
			<h1>Welcome</h1>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<SubmitButton>Submit Form</SubmitButton>
		</div>
	)
}`

const H1_WTEXT = `const Heading: React.FC = () => <h1>Welcome</h1>;

export const App = () => {
	return (
		<div>
			<Heading />
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<button className="btn-primary">Submit Form</button>
		</div>
	)
}`

const H1_NOTEXT = `const Heading: React.FC<React.PropsWithChildren> = ({ children }) => <h1>{children}</h1>;

export const App = () => {
	return (
		<div>
			<Heading>Welcome</Heading>
			{/* Target: Extract <button> into \`SubmitButton\` */}
			<button className="btn-primary">Submit Form</button>
		</div>
	)
}`

describe('[1-simple] Extract JSX Component Refactoring', () =>
{
	sft('should extract <button> into SubmitButton', INPUT_CODE, BUTTON_WITH_TEXT, ({
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
			hardcodeChildren: true, // User decides to hardcode "Submit Form" into the new component
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
	sft('should extract <button> into SubmitButton (with children)', INPUT_CODE, BUTTON_NO_TEXT, ({
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
			hardcodeChildren: false,
			selectedProps: []      // No props to pass
		} satisfies RefactorDecisions

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		)
		// console.log(applyTextChanges(INPUT_CODE, result.textChanges))

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const SubmitButton = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxElement); // <SubmitButton>...</SubmitButton>

		return result
	});
	sft('should extract <h1> into Heading (with children)', INPUT_CODE, H1_NOTEXT, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) =>
	{
		// Find the text offsets for: <h1>Header</h1>
		const h1Start = inputCode.lastIndexOf('<h1');
		const h1End = inputCode.indexOf('</h1>') + '</h1>'.length;
		const selection = { start: h1Start, end: h1End };


		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection)
		const h1Candidate = candidates.find(c => c.description.includes('<h1'))!;


		// -------------------------------------------------------------------
		// STEP 2: Detect Props and Context
		// -------------------------------------------------------------------
		const decisionsRequest = detectPropsList(
			sourceFile,
			typeChecker,
			h1Candidate
		);


		// -------------------------------------------------------------------
		// STEP 3: Perform Refactor
		// -------------------------------------------------------------------
		const decisions = {
			componentName: 'Heading',
			hardcodeChildren: false,
			selectedProps: []      // No props to pass
		} satisfies RefactorDecisions

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		)
		// console.log(applyTextChanges(INPUT_CODE, result.textChanges))

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const Heading = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxElement); // <Heading>...</Heading>

		return result
	});
	sft('should extract <h1> into Heading', INPUT_CODE, H1_WTEXT, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) =>
	{
		// Find the text offsets for: <h1>Header</h1>
		const h1Start = inputCode.lastIndexOf('<h1');
		const h1End = inputCode.indexOf('</h1>') + '</h1>'.length;
		const selection = { start: h1Start, end: h1End };


		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection)
		const h1Candidate = candidates.find(c => c.description.includes('<h1'))!;


		// -------------------------------------------------------------------
		// STEP 2: Detect Props and Context
		// -------------------------------------------------------------------
		const decisionsRequest = detectPropsList(
			sourceFile,
			typeChecker,
			h1Candidate
		);


		// -------------------------------------------------------------------
		// STEP 3: Perform Refactor
		// -------------------------------------------------------------------
		const decisions = {
			componentName: 'Heading',
			hardcodeChildren: true,
			selectedProps: []      // No props to pass
		} satisfies RefactorDecisions

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		)
		// console.log(applyTextChanges(INPUT_CODE, result.textChanges))

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const Heading = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxSelfClosingElement); // <Heading />

		return result
	});
});
