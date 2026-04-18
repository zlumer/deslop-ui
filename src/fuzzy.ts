import * as ts from 'typescript';

/**
 * Uses TypeScript AST to compare two code snippets for "fuzzy" equality, ignoring formatting and minor differences.
 * This is used in tests to verify that the refactored code is semantically the same as the expected code, even if whitespace or formatting differs.
 * This also equals `type` and `interface` declarations that have the same properties.
 * @param a 
 * @param b 
 */
export function equals(a: string, b: string): boolean {
	const sourceA = ts.createSourceFile('a.tsx', a, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const sourceB = ts.createSourceFile('b.tsx', b, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

	const normA = normalizeNode(sourceA);
	const normB = normalizeNode(sourceB);

	return JSON.stringify(normA) === JSON.stringify(normB);
}

function normalizeNode(node: ts.Node): any {
	if (!node) return null;

	// Ignore tokens that are just syntax/formatting
	if (
		node.kind === ts.SyntaxKind.CommaToken ||
		node.kind === ts.SyntaxKind.SemicolonToken ||
		node.kind === ts.SyntaxKind.EndOfFileToken
	) {
		return null;
	}

	// Unwrap parentheses
	if (ts.isParenthesizedExpression(node)) {
		return normalizeNode(node.expression);
	}

	// Unwrap blocks with a single return statement
	if (ts.isBlock(node) && node.statements.length === 1 && ts.isReturnStatement(node.statements[0])) {
		return normalizeNode(node.statements[0].expression!);
	}

	const result: any = {};

	// Normalize Interface to TypeAlias for comparison
	if (ts.isInterfaceDeclaration(node)) {
		result.kind = ts.SyntaxKind.TypeAliasDeclaration;
		result.name = normalizeNode(node.name);
		result.type = {
			kind: ts.SyntaxKind.TypeLiteral,
			members: normalizeArray(node.members)
		};
		return result;
	}

	result.kind = node.kind;

	if (ts.isIdentifier(node)) {
		result.text = node.text;
		return result;
	}

	if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isJsxText(node)) {
		result.text = node.text.trim();
		if (result.text === '') return null;
		return result;
	}

	// Extract relevant properties based on node type
	if (ts.isTypeAliasDeclaration(node)) {
		result.name = normalizeNode(node.name);
		result.type = normalizeNode(node.type);
	} else if (ts.isTypeLiteralNode(node)) {
		result.members = normalizeArray(node.members);
	} else if (ts.isPropertySignature(node)) {
		result.name = normalizeNode(node.name);
		result.type = normalizeNode(node.type!);
	} else if (ts.isVariableStatement(node)) {
		result.declarations = normalizeArray(node.declarationList.declarations);
	} else if (ts.isVariableDeclaration(node)) {
		result.name = normalizeNode(node.name);
		result.initializer = node.initializer ? normalizeNode(node.initializer) : null;
	} else if (ts.isArrowFunction(node) || ts.isFunctionDeclaration(node)) {
		result.parameters = normalizeArray(node.parameters);
		result.body = normalizeNode(node.body!);
	} else if (ts.isParameter(node)) {
		result.name = normalizeNode(node.name);
		result.type = node.type ? normalizeNode(node.type) : null;
	} else if (ts.isObjectBindingPattern(node)) {
		result.elements = normalizeArray(node.elements);
	} else if (ts.isBindingElement(node)) {
		result.name = normalizeNode(node.name);
	} else if (ts.isJsxElement(node)) {
		result.tagName = normalizeNode(node.openingElement.tagName);
		result.attributes = normalizeNode(node.openingElement.attributes);
		result.children = normalizeArray(node.children);
	} else if (ts.isJsxSelfClosingElement(node)) {
		result.tagName = normalizeNode(node.tagName);
		result.attributes = normalizeNode(node.attributes);
		result.children = []; // Normalize self-closing to have empty children for comparison
	} else if (ts.isJsxOpeningElement(node)) {
		result.tagName = normalizeNode(node.tagName);
		result.attributes = normalizeNode(node.attributes);
	} else if (ts.isJsxAttributes(node)) {
		result.properties = normalizeArray(node.properties);
	} else if (ts.isJsxAttribute(node)) {
		result.name = normalizeNode(node.name);
		result.initializer = node.initializer ? normalizeNode(node.initializer) : null;
	} else if (ts.isJsxExpression(node)) {
		result.expression = node.expression ? normalizeNode(node.expression) : null;
	} else if (ts.isReturnStatement(node)) {
		result.expression = node.expression ? normalizeNode(node.expression) : null;
	} else if (ts.isBlock(node)) {
		result.statements = normalizeArray(node.statements);
	} else if (ts.isSourceFile(node)) {
		result.statements = normalizeArray(node.statements);
	} else if (ts.isModifier(node)) {
		result.kind = node.kind;
	} else {
		// Fallback: process children
		const children: any[] = [];
		ts.forEachChild(node, child => {
			const normalized = normalizeNode(child);
			if (normalized) children.push(normalized);
		});
		if (children.length > 0) {
			result.children = children;
		}
	}

	return result;
}

function normalizeArray(nodes: ts.NodeArray<ts.Node> | readonly ts.Node[]): any[] {
	if (!nodes) return [];
	const arr = nodes.map(normalizeNode).filter(n => n !== null);
	
	// Sort members/properties to ignore ordering differences
	if (arr.length > 0 && (
		arr[0].kind === ts.SyntaxKind.PropertySignature || 
		arr[0].kind === ts.SyntaxKind.BindingElement || 
		arr[0].kind === ts.SyntaxKind.JsxAttribute
	)) {
		arr.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
	}
	
	return arr;
}
