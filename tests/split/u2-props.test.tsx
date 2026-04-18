import { describe, expect } from 'vitest';
import * as ts from 'typescript';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';
import { sft } from './utils';
import { applyTextChanges } from '../../src/extract/applyTextChanges';

const INPUT_CODE = `export const UserProfile = () =>
{
	const userName = "Alice";
	const age = 28;
	return (
		<div>
			{/* Target: Extract <div> into \`UserInfo\` */}
			<div className="user-info">
				<h2>{userName}</h2>
				<p>Age: {age}</p>
			</div>
		</div>
	);
};`;


const OUTPUT_CODE = `type UserInfoProps = {
	userName: string;
	age: number;
}
const UserInfo: React.FC<UserInfoProps> = ({ userName, age }) => (
	<div className="user-info">
		<h2>{userName}</h2>
		<p>Age: {age}</p>
	</div>
);
export const UserProfile = () =>
{
	const userName = "Alice";
	const age = 28;
	return (
		<div>
			<UserInfo userName={userName} age={age} />
		</div>
	);
};`

describe('[2-props]', () =>
{
	sft('should extract <div> into UserInfo', INPUT_CODE, OUTPUT_CODE, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) =>
	{
		// Find the text offsets for: <div className="user-info">
		const divStart = inputCode.lastIndexOf('<div className="user-info"');
		const divEnd = inputCode.indexOf('</div>', divStart) + '</div>'.length;
		const selection = { start: divStart, end: divEnd };


		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection)
		// console.log('Detected Candidates:', candidates.map(c => c.description));

		// Assertions for Step 1
		expect(candidates.length).toBeGreaterThanOrEqual(1);
		const divCandidate = candidates.find(c => c.description.includes('<div'))!;
		expect(divCandidate).toBeDefined();
		expect(divCandidate.node.kind).toBe(ts.SyntaxKind.JsxElement);
		expect(divCandidate.description).toContain('<div');


		// -------------------------------------------------------------------
		// STEP 2: Detect Props and Context
		// -------------------------------------------------------------------
		const decisionsRequest = detectPropsList(
			sourceFile,
			typeChecker,
			divCandidate
		);

		// Assertions for Step 2
		// Since the <div> uses external variables from UserProfile, props should be detected
		expect(decisionsRequest.props).toHaveLength(2);
		expect(decisionsRequest.props.map(p => p.name)).toEqual(expect.arrayContaining(['userName', 'age']));
		expect(decisionsRequest.hasChildren).toBe(true); // It has an <h2> and <p> child, but no direct text content
		expect(decisionsRequest.childrenNodes.length).toBe(2);


		// -------------------------------------------------------------------
		// STEP 3: Perform Refactor
		// -------------------------------------------------------------------
		const decisions = {
			componentName: 'UserInfo',
			hardcodeChildren: false, // No children to extract
			selectedProps: ['userName', 'age'] // Pass detected props
		} satisfies RefactorDecisions

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		)
		// console.log(applyTextChanges(INPUT_CODE, result.textChanges))

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const UserInfo = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxSelfClosingElement); // <UserInfo />

		return result
	});
});
