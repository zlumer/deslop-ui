import { describe, expect } from 'vitest';
import * as ts from 'typescript';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';
import { sft } from './utils';

const INPUT_CODE = `export const App = () => {
	return (
		<div><p>Hello</p> <p>World</p></div>
	);
};`;

const OUTPUT_A = `const A: React.FC<React.PropsWithChildren> = ({ children }) => <div><p>Hello</p> <p>{children}</p></div>;
export const App = () => {
	return (
		<A>World</A>
	);
};`;

const OUTPUT_B = `const B: React.FC<React.PropsWithChildren> = ({ children }) => <div><p>{children}</p> <p>World</p></div>;
export const App = () => {
	return (
		<B>Hello</B>
	);
};`;

const OUTPUT_C = `const C: React.FC<React.PropsWithChildren> = ({ children }) => <div><p>Hello</p>{children}</div>;
export const App = () => {
	return (
		<C> <p>World</p></C>
	);
};`;

describe('[7-children]', () => {
	sft('should extract div into A and pass World as children', INPUT_CODE, OUTPUT_A, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) => {
		const divStart = inputCode.indexOf('<div>');
		const divEnd = inputCode.indexOf('</div>') + '</div>'.length;
		const selection = { start: divStart, end: divEnd };

		const candidates = detectComponents(sourceFile, selection);
		const divCandidate = candidates.find(c => c.description.includes('<div'))!;
		const decisionsRequest = detectPropsList(sourceFile, typeChecker, divCandidate);

		let worldNode: ts.JsxChild | undefined;
		ts.forEachChild(divCandidate.node, function visit(node) {
			if (ts.isJsxText(node) && node.text === 'World') {
				worldNode = node;
			}
			ts.forEachChild(node, visit);
		});

		const decisions = {
			componentName: 'A',
			childrenReplacementNodes: worldNode ? [worldNode] : []
		} satisfies RefactorDecisions;

		return performRefactoring(sourceFile, decisionsRequest, decisions);
	});

	sft('should extract div into B and pass Hello as children', INPUT_CODE, OUTPUT_B, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) => {
		const divStart = inputCode.indexOf('<div>');
		const divEnd = inputCode.indexOf('</div>') + '</div>'.length;
		const selection = { start: divStart, end: divEnd };

		const candidates = detectComponents(sourceFile, selection);
		const divCandidate = candidates.find(c => c.description.includes('<div'))!;
		const decisionsRequest = detectPropsList(sourceFile, typeChecker, divCandidate);

		let helloNode: ts.JsxChild | undefined;
		ts.forEachChild(divCandidate.node, function visit(node) {
			if (ts.isJsxText(node) && node.text === 'Hello') {
				helloNode = node;
			}
			ts.forEachChild(node, visit);
		});

		const decisions = {
			componentName: 'B',
			childrenReplacementNodes: helloNode ? [helloNode] : []
		} satisfies RefactorDecisions;

		return performRefactoring(sourceFile, decisionsRequest, decisions);
	});

	sft('should extract div into C and pass <p>World</p> as children', INPUT_CODE, OUTPUT_C, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) => {
		const divStart = inputCode.indexOf('<div>');
		const divEnd = inputCode.indexOf('</div>') + '</div>'.length;
		const selection = { start: divStart, end: divEnd };

		const candidates = detectComponents(sourceFile, selection);
		const divCandidate = candidates.find(c => c.description.includes('<div'))!;
		const decisionsRequest = detectPropsList(sourceFile, typeChecker, divCandidate);

		const divElement = divCandidate.node as ts.JsxElement;
		const children = divElement.children;
		// children[0] is <p>Hello</p>
		// children[1] is " "
		// children[2] is <p>World</p>
		const replacementNodes = [children[1], children[2]];

		const decisions = {
			componentName: 'C',
			childrenReplacementNodes: replacementNodes
		} satisfies RefactorDecisions;

		return performRefactoring(sourceFile, decisionsRequest, decisions);
	});
});
