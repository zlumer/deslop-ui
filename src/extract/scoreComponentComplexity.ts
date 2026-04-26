// src/extract/scoreComponentComplexity.ts
import * as ts from 'typescript';

export interface ComponentComplexity {
	attributesCount: number;
	childrenCount: number;
	conditionalsCount: number;
	maxDepth: number;
	expressionsCount: number;
}

export function scoreComponentComplexity(node: ts.Node): ComponentComplexity {
	let attributesCount = 0;
	let conditionalsCount = 0;
	let expressionsCount = 0;
	let maxDepth = 0;

	function visit(n: ts.Node, currentDepth: number) {
		maxDepth = Math.max(maxDepth, currentDepth);

		if (ts.isJsxAttribute(n) || ts.isJsxSpreadAttribute(n)) {
			attributesCount++;
		} else if (ts.isConditionalExpression(n)) {
			conditionalsCount++;
		} else if (ts.isBinaryExpression(n) && [
			ts.SyntaxKind.AmpersandAmpersandToken,
			ts.SyntaxKind.BarBarToken,
			ts.SyntaxKind.QuestionQuestionToken
		].includes(n.operatorToken.kind)) {
			conditionalsCount++;
		} else if (ts.isJsxExpression(n)) {
			expressionsCount++;
		}

		const increasesDepth = ts.isJsxElement(n) || ts.isJsxFragment(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);
		ts.forEachChild(n, child => visit(child, currentDepth + (increasesDepth ? 1 : 0)));
	}

	visit(node, 0);

	return {
		attributesCount,
		conditionalsCount,
		maxDepth,
		expressionsCount,
		childrenCount: (ts.isJsxElement(node) || ts.isJsxFragment(node)) 
			? node.children.filter(c => !ts.isJsxText(c) || c.text.trim().length > 0).length 
			: 0
	};
}
