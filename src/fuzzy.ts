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
		node.kind === ts.SyntaxKind.EndOfFileToken ||
		node.kind === ts.SyntaxKind.EmptyStatement ||
		node.kind === ts.SyntaxKind.SemicolonToken ||
		node.kind === ts.SyntaxKind.CommaToken
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

	// Ignore empty JSX expressions (often used for comments like {/* comment */})
	if (ts.isJsxExpression(node) && !node.expression) {
		return null;
	}

	const result: any = { kind: node.kind };

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

	if (ts.isTypeAliasDeclaration(node)) {
		result.name = normalizeNode(node.name);
		result.type = normalizeNode(node.type);
		return result;
	}

	if (ts.isTypeLiteralNode(node)) {
		result.members = normalizeArray(node.members);
		return result;
	}

	if (ts.isPropertySignature(node)) {
		result.name = normalizeNode(node.name);
		result.type = normalizeNode(node.type);
		return result;
	}

	if (ts.isIdentifier(node)) {
		result.text = node.text;
		return result;
	}

	if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isJsxText(node)) {
		const text = node.text.trim();
		if (text === '') return null;
		result.text = text;
		return result;
	}

	// Ignore type annotations on variable declarations to match `const x = ...` with `const x: React.FC = ...`
	if (ts.isVariableDeclaration(node)) {
		result.name = normalizeNode(node.name);
		result.initializer = normalizeNode(node.initializer);
		return result;
	}

	// Normalize empty JsxElement (e.g. <span></span>) to JsxSelfClosingElement (e.g. <span/>)
	if (ts.isJsxElement(node)) {
		const children = normalizeArray(node.children);
		if (children.length === 0) {
			result.kind = ts.SyntaxKind.JsxSelfClosingElement;
			result.tagName = normalizeNode(node.openingElement.tagName);
			result.attributes = normalizeNode(node.openingElement.attributes);
			return result;
		}
	}

	if (ts.isJsxSelfClosingElement(node)) {
		result.kind = ts.SyntaxKind.JsxSelfClosingElement;
		result.tagName = normalizeNode(node.tagName);
		result.attributes = normalizeNode(node.attributes);
		return result;
	}

	const children: any[] = [];
	ts.forEachChild(node, child => {
		const norm = normalizeNode(child);
		if (norm) children.push(norm);
	});

	if (children.length > 0) {
		// Sort attributes and binding patterns to ignore ordering differences
		if (
			node.kind === ts.SyntaxKind.JsxAttributes ||
			node.kind === ts.SyntaxKind.ObjectBindingPattern
		) {
			children.sort((a, b) => {
				const strA = JSON.stringify(a);
				const strB = JSON.stringify(b);
				if (strA < strB) return -1;
				if (strA > strB) return 1;
				return 0;
			});
		}
		result.children = children;
	}

	return result;
}

function normalizeArray(nodes: readonly ts.Node[]): any[] {
	if (!nodes) return [];
	const arr = nodes.map(n => normalizeNode(n)).filter(n => n !== null);
	
	if (arr.length > 0 && arr[0] && (
		arr[0].kind === ts.SyntaxKind.PropertySignature || 
		arr[0].kind === ts.SyntaxKind.BindingElement || 
		arr[0].kind === ts.SyntaxKind.JsxAttribute
	)) {
		arr.sort((a, b) => {
			const strA = JSON.stringify(a);
			const strB = JSON.stringify(b);
			if (strA < strB) return -1;
			if (strA > strB) return 1;
			return 0;
		});
	}
	
	return arr;
}
