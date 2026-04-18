import * as ts from 'typescript';
import { ExtractionCandidate, DecisionsRequest } from './types';

/**
 * 2. Analyzes the chosen component to detect required props, scope variables,
 * and children, returning a request for the user/system to make decisions.
 *
 * @param sourceFile - The parsed AST of the current file.
 * @param typeChecker - TS TypeChecker to resolve symbols and variable scope.
 * @param astData - The chosen candidate from Step 1.
 */

export function detectPropsList(
	sourceFile: ts.SourceFile,
	typeChecker: ts.TypeChecker,
	astData: ExtractionCandidate
): DecisionsRequest
{
	const node = astData.node;
	let hasChildren = false;
	let childrenNodes: ts.JsxChild[] = [];

	if (ts.isJsxElement(node))
	{
		hasChildren = node.children.length > 0;
		childrenNodes = Array.from(node.children);
	} else if (ts.isJsxFragment(node))
	{
		hasChildren = node.children.length > 0;
		childrenNodes = Array.from(node.children);
	}

	return {
		astData,
		props: [],
		hasChildren,
		childrenNodes
	};
}
