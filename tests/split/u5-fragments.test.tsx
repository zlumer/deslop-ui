import { describe, expect } from 'vitest';
import * as ts from 'typescript';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';
import { sft } from './utils';

const INPUT_CODE = `export const Notification = ({ isError, message }: { isError: boolean, message: string }) => {
	return (
		<div>
			/* Target: Extract BOTH the SVG and the Span into \`ErrorBanner\` */
			{isError && (
				<>
					<svg width="24" height="24"><g></g></svg>
					<span className="error-text">{message}</span>
				</>
			)}
		</div>
	);
};`;

const OUTPUT_CODE = `type ErrorBannerProps = {
	message: string;
}
const ErrorBanner: React.FC<ErrorBannerProps> = ({ message }) => (
	<>
		<svg width="24" height="24"><g></g></svg>
		<span className="error-text">{message}</span>
	</>
);
export const Notification = ({ isError, message }: { isError: boolean, message: string }) => {
	return (
		<div>
			/* Target: Extract BOTH the SVG and the Span into \`ErrorBanner\` */
			{isError && (
				<ErrorBanner message={message}/>
			)}
		</div>
	);
};`;

describe('[5-fragments]', () =>
{
	sft('should extract <>...</> into ErrorBanner', INPUT_CODE, OUTPUT_CODE, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) =>
	{
		// Find the text offsets for: <>...</>
		const fragmentStart = inputCode.indexOf('<>');
		const fragmentEnd = inputCode.indexOf('</>') + '</>'.length;
		const selection = { start: fragmentStart, end: fragmentEnd };

		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection);
		
		// Assertions for Step 1
		expect(candidates.length).toBeGreaterThanOrEqual(1);
		const fragmentCandidate = candidates.find(c => c.description.includes('<>'))!;
		expect(fragmentCandidate).toBeDefined();
		expect(fragmentCandidate.node.kind).toBe(ts.SyntaxKind.JsxFragment);
		expect(fragmentCandidate.description).toContain('<>');

		// -------------------------------------------------------------------
		// STEP 2: Detect Props and Context
		// -------------------------------------------------------------------
		const decisionsRequest = detectPropsList(
			sourceFile,
			typeChecker,
			fragmentCandidate
		);

		// Assertions for Step 2
		// Since the fragment uses the external variable `message`, props should be detected
		expect(decisionsRequest.props).toHaveLength(1);
		expect(decisionsRequest.props.map(p => p.name)).toEqual(expect.arrayContaining(['message']));
		expect(decisionsRequest.hasChildren).toBe(true);

		// -------------------------------------------------------------------
		// STEP 3: Perform Refactor
		// -------------------------------------------------------------------
		const decisions = {
			componentName: 'ErrorBanner',
			childrenReplacementNodes: [] // Hardcode children into new component
		} satisfies RefactorDecisions;

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		);

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const ErrorBanner = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxSelfClosingElement); // <ErrorBanner />

		return result;
	});
});
