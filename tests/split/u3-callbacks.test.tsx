import { describe, expect } from 'vitest';
import * as ts from 'typescript';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';
import { sft } from './utils';

const INPUT_CODE = `import { useState } from 'react';
export const Counter = () => {
	const [count, setCount] = useState(0);
	const handleIncrement = () => setCount(prev => prev + 1);
	return (
		<div>
			<p>Count: {count}</p>
			{/* Target: Extract <button> into \`IncrementButton\` */}
			<button onClick={handleIncrement} disabled={count > 10}>
				Add +1
			</button>
		</div>
	);
};`;

const OUTPUT_CODE = `import { useState } from 'react';
type IncrementButtonProps = {
	handleIncrement: () => void;
	count: number;
}
const IncrementButton: React.FC<IncrementButtonProps> = ({ handleIncrement, count }) => (
	<button onClick={handleIncrement} disabled={count > 10}>
		Add +1
	</button>
);
export const Counter = () => {
	const [count, setCount] = useState(0);
	const handleIncrement = () => setCount(prev => prev + 1);
	return (
		<div>
			<p>Count: {count}</p>
			<IncrementButton handleIncrement={handleIncrement} count={count}/>
		</div>
	);
};`;

describe('[3-callbacks]', () =>
{
	sft('should extract <button> into IncrementButton', INPUT_CODE, OUTPUT_CODE, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) =>
	{
		// Find the text offsets for: <button ...>...</button>
		const buttonStart = inputCode.lastIndexOf('<button');
		const buttonEnd = inputCode.indexOf('</button>') + '</button>'.length;
		const selection = { start: buttonStart, end: buttonEnd };

		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection);
		
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
		// Since the <button> uses external variables `handleIncrement` and `count`, props should be detected
		expect(decisionsRequest.props).toHaveLength(2);
		expect(decisionsRequest.props.map(p => p.name)).toEqual(expect.arrayContaining(['handleIncrement', 'count']));
		expect(decisionsRequest.hasChildren).toBe(true); // It has text content "Add +1"

		// -------------------------------------------------------------------
		// STEP 3: Perform Refactor
		// -------------------------------------------------------------------
		const decisions = {
			componentName: 'IncrementButton',
			selectedProps: ['handleIncrement', 'count'], // Pass detected props
			childrenReplacementNodes: [] // Hardcode children into new component
		} satisfies RefactorDecisions;

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		);

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const IncrementButton = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxSelfClosingElement); // <IncrementButton />

		return result;
	});
});
