// src/extract/scoreComponentComplexity.ts
import * as ts from 'typescript';

export interface ComplexityMetrics {
	attributesCount: number;
	interactiveAttributesCount: number;
	conditionalsCount: number;
	expressionsCount: number;
	listRenderingsCount: number;
	inlineFunctionsCount: number;
	renderPropsCount: number;
	stylingVolume: number;
	textVolume: number;
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

export type ExtractionType = 'atom' | 'layout' | 'list' | 'content' | 'unknown';

export interface ComponentComplexity extends ComplexityMetrics {
	childrenCount: number;
	maxDepth: number;
	self: ComplexityMetrics;
	content: ComplexityMetrics;
	extractionType: ExtractionType;
	extractionWarnings: string[];
}

function analyzeNodes(nodes: ts.Node[], initialDepth: number): Omit<ComplexityMetrics, 'score' | 'vector'> & { maxDepth: number } {
	let attributesCount = 0;
	let conditionalsCount = 0;
	let expressionsCount = 0;
	let maxDepth = initialDepth;
	let listRenderingsCount = 0;
	let inlineFunctionsCount = 0;
	let renderPropsCount = 0;
	let stylingVolume = 0;
	let textVolume = 0;
	let interactiveAttributesCount = 0;
	let rawNodeCount = 0;
	const identifiers = new Set<string>();

	function visit(n: ts.Node, currentDepth: number) {
		rawNodeCount++;
		maxDepth = Math.max(maxDepth, currentDepth);

		if (ts.isJsxText(n)) {
			textVolume += n.text.trim().length;
		} else if (ts.isJsxAttribute(n) || ts.isJsxSpreadAttribute(n)) {
			attributesCount++;
			if (ts.isJsxAttribute(n)) {
				const name = n.name.getText();
				if (name.startsWith('on') && name.length > 2 && name[2] === name[2].toUpperCase()) {
					interactiveAttributesCount++;
				}
			}
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
			if (n.expression && (ts.isArrowFunction(n.expression) || ts.isFunctionExpression(n.expression))) {
				if (n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
					renderPropsCount++;
				}
			}
		} else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'map') {
			listRenderingsCount++;
		} else if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
			inlineFunctionsCount++;
		} else if (ts.isIdentifier(n)) {
			const parent = n.parent;
			if (!(ts.isPropertyAccessExpression(parent) && parent.name === n) &&
				!(ts.isJsxAttribute(parent) && parent.name === n)) {
				identifiers.add(n.text);
			}
		}

		const increasesDepth = ts.isJsxElement(n) || ts.isJsxFragment(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);
		ts.forEachChild(n, child => visit(child, currentDepth + (increasesDepth ? 1 : 0)));
	}

	nodes.forEach(n => visit(n, initialDepth));

	return {
		attributesCount,
		interactiveAttributesCount,
		conditionalsCount,
		expressionsCount,
		listRenderingsCount,
		inlineFunctionsCount,
		renderPropsCount,
		stylingVolume,
		textVolume,
		rawNodeCount,
		externalDependenciesCount: identifiers.size,
		maxDepth
	};
}

function calculateMetrics(raw: ReturnType<typeof analyzeNodes>, childrenCount: number): ComplexityMetrics {
	const score = 
		(raw.conditionalsCount * 3.0) + 
		(raw.listRenderingsCount * 3.0) + 
		(raw.inlineFunctionsCount * 2.5) + 
		(raw.renderPropsCount * 4.0) +
		(raw.maxDepth * 2.0) + 
		(raw.externalDependenciesCount * 2.0) + 
		(raw.expressionsCount * 1.5) + 
		(raw.attributesCount * 1.0) + 
		(raw.stylingVolume * 0.05) + 
		(raw.textVolume * 0.01) +
		(childrenCount * 0.5);

	const vector = {
		logical: (raw.conditionalsCount * 3) + (raw.listRenderingsCount * 2) + (raw.inlineFunctionsCount * 2) + raw.expressionsCount,
		structural: (raw.maxDepth * 2) + childrenCount + (raw.rawNodeCount * 0.1),
		interface: raw.attributesCount,
		coupling: raw.externalDependenciesCount,
		styling: raw.stylingVolume
	};

	return {
		...raw,
		score,
		vector
	};
}

export function scoreComponentComplexity(node: ts.Node): ComponentComplexity {
	const selfNodes: ts.Node[] = [];
	const contentNodes: ts.Node[] = [];
	let childrenCount = 0;
	let isCustomComponent = false;
	let isFragment = false;

	if (ts.isJsxElement(node)) {
		selfNodes.push(node.openingElement);
		contentNodes.push(...node.children);
		childrenCount = node.children.filter(c => !ts.isJsxText(c) || c.text.trim().length > 0).length;
		isCustomComponent = /^[A-Z]/.test(node.openingElement.tagName.getText());
	} else if (ts.isJsxSelfClosingElement(node)) {
		selfNodes.push(node);
		isCustomComponent = /^[A-Z]/.test(node.tagName.getText());
	} else if (ts.isJsxFragment(node)) {
		contentNodes.push(...node.children);
		childrenCount = node.children.filter(c => !ts.isJsxText(c) || c.text.trim().length > 0).length;
		isFragment = true;
	} else {
		selfNodes.push(node);
	}

	const rawSelf = analyzeNodes(selfNodes, 0);
	const rawContent = analyzeNodes(contentNodes, 1); // Content starts at depth 1 relative to root

	const selfMetrics = calculateMetrics(rawSelf, 0);
	const contentMetrics = calculateMetrics(rawContent, childrenCount);

	// Combine for total
	const totalRaw = {
		attributesCount: rawSelf.attributesCount + rawContent.attributesCount,
		interactiveAttributesCount: rawSelf.interactiveAttributesCount + rawContent.interactiveAttributesCount,
		conditionalsCount: rawSelf.conditionalsCount + rawContent.conditionalsCount,
		expressionsCount: rawSelf.expressionsCount + rawContent.expressionsCount,
		listRenderingsCount: rawSelf.listRenderingsCount + rawContent.listRenderingsCount,
		inlineFunctionsCount: rawSelf.inlineFunctionsCount + rawContent.inlineFunctionsCount,
		renderPropsCount: rawSelf.renderPropsCount + rawContent.renderPropsCount,
		stylingVolume: rawSelf.stylingVolume + rawContent.stylingVolume,
		textVolume: rawSelf.textVolume + rawContent.textVolume,
		rawNodeCount: rawSelf.rawNodeCount + rawContent.rawNodeCount,
		externalDependenciesCount: rawSelf.externalDependenciesCount + rawContent.externalDependenciesCount,
		maxDepth: Math.max(rawSelf.maxDepth, rawContent.maxDepth)
	};

	const totalMetrics = calculateMetrics(totalRaw, childrenCount);

	let extractionType: ExtractionType = 'unknown';
	const extractionWarnings: string[] = [];

	if (isCustomComponent && childrenCount === 0) {
		extractionType = 'unknown';
		extractionWarnings.push('This is already a custom component with no children. Extracting it further is usually unnecessary.');
	} else if (totalMetrics.listRenderingsCount > 0) {
		extractionType = 'list';
	} else if (contentMetrics.textVolume > 200 && totalMetrics.vector.logical < 5 && totalMetrics.vector.structural < 10) {
		extractionType = 'content';
	} else if (!isFragment && !isCustomComponent && (selfMetrics.stylingVolume > 20 || (selfMetrics.attributesCount > 0 && contentMetrics.score < 5)) && contentMetrics.score < 10) {
		extractionType = 'atom';
	} else if (contentMetrics.vector.structural > 15 && selfMetrics.vector.logical < 5) {
		extractionType = 'layout';
	}

	if (totalMetrics.vector.coupling > 6 && extractionType !== 'unknown') {
		extractionWarnings.push('High coupling detected. Consider grouping props.');
	}

	return {
		...totalMetrics,
		childrenCount,
		maxDepth: totalRaw.maxDepth,
		self: selfMetrics,
		content: contentMetrics,
		extractionType,
		extractionWarnings
	};
}
