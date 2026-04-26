// src/extract/scoreComponentComplexity.ts
import * as ts from 'typescript';

export interface ComponentComplexity {
	attributesCount: number;
	childrenCount: number;
	conditionalsCount: number;
	maxDepth: number;
	expressionsCount: number;
	listRenderingsCount: number;
	inlineFunctionsCount: number;
	stylingVolume: number;
	rawNodeCount: number;
	externalDependenciesCount: number;
	score: number;
	vector: {
		logical: number;
		structural: number;
		interface: number;
		coupling: number;
		styling: number;
	};
}

export function scoreComponentComplexity(node: ts.Node): ComponentComplexity {
	let attributesCount = 0;
	let conditionalsCount = 0;
	let expressionsCount = 0;
	let maxDepth = 0;
	let listRenderingsCount = 0;
	let inlineFunctionsCount = 0;
	let stylingVolume = 0;
	let rawNodeCount = 0;
	const identifiers = new Set<string>();

	function visit(n: ts.Node, currentDepth: number) {
		rawNodeCount++;
		maxDepth = Math.max(maxDepth, currentDepth);

		if (ts.isJsxAttribute(n) || ts.isJsxSpreadAttribute(n)) {
			attributesCount++;
			if (ts.isJsxAttribute(n) && n.name.getText() === 'className' && n.initializer) {
				if (ts.isStringLiteral(n.initializer)) {
					stylingVolume += n.initializer.text.length;
				} else if (ts.isJsxExpression(n.initializer) && n.initializer.expression) {
					stylingVolume += n.initializer.expression.getText().length;
				}
			}
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
		} else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'map') {
			listRenderingsCount++;
		} else if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
			inlineFunctionsCount++;
		} else if (ts.isIdentifier(n)) {
			const parent = n.parent;
			// Approximate coupling by counting unique identifiers not used as property names or JSX attributes
			if (!(ts.isPropertyAccessExpression(parent) && parent.name === n) &&
				!(ts.isJsxAttribute(parent) && parent.name === n)) {
				identifiers.add(n.text);
			}
		}

		const increasesDepth = ts.isJsxElement(n) || ts.isJsxFragment(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);
		ts.forEachChild(n, child => visit(child, currentDepth + (increasesDepth ? 1 : 0)));
	}

	visit(node, 0);

	const childrenCount = (ts.isJsxElement(node) || ts.isJsxFragment(node)) 
		? node.children.filter(c => !ts.isJsxText(c) || c.text.trim().length > 0).length 
		: 0;
	const externalDependenciesCount = identifiers.size;

	const score = 
		(conditionalsCount * 3.0) + 
		(listRenderingsCount * 3.0) + 
		(inlineFunctionsCount * 2.5) + 
		(maxDepth * 2.0) + 
		(externalDependenciesCount * 2.0) + 
		(expressionsCount * 1.5) + 
		(attributesCount * 1.0) + 
		(stylingVolume * 0.05) + 
		(childrenCount * 0.5);

	const vector = {
		logical: (conditionalsCount * 3) + (listRenderingsCount * 2) + (inlineFunctionsCount * 2) + expressionsCount,
		structural: (maxDepth * 2) + childrenCount + (rawNodeCount * 0.1),
		interface: attributesCount,
		coupling: externalDependenciesCount,
		styling: stylingVolume
	};

	return {
		attributesCount,
		conditionalsCount,
		maxDepth,
		expressionsCount,
		childrenCount,
		listRenderingsCount,
		inlineFunctionsCount,
		stylingVolume,
		rawNodeCount,
		externalDependenciesCount,
		score,
		vector
	};
}
