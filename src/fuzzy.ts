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

function normalizeNode(node: any): any {
	if (!node) return null;
	if (typeof node !== 'object') return node;

	if (Array.isArray(node)) {
		const arr = node.map(normalizeNode).filter(n => n !== null);
		
		// Sort members/properties to ignore ordering differences
		if (arr.length > 0 && arr[0] && typeof arr[0] === 'object' && (
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

	// Ignore tokens that are just syntax/formatting
	if (
		node.kind === ts.SyntaxKind.CommaToken ||
		node.kind === ts.SyntaxKind.SemicolonToken ||
		node.kind === ts.SyntaxKind.EndOfFileToken ||
		node.kind === ts.SyntaxKind.EmptyStatement
	) {
		return null;
	}

	// Unwrap parentheses
	if (node.kind === ts.SyntaxKind.ParenthesizedExpression) {
		return normalizeNode(node.expression);
	}

	// Unwrap blocks with a single return statement
	if (node.kind === ts.SyntaxKind.Block && node.statements && node.statements.length === 1 && node.statements[0].kind === ts.SyntaxKind.ReturnStatement) {
		return normalizeNode(node.statements[0].expression);
	}

	const result: any = {};

	// Normalize Interface to TypeAlias for comparison
	if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
		result.kind = ts.SyntaxKind.TypeAliasDeclaration;
		result.name = normalizeNode(node.name);
		result.type = {
			kind: ts.SyntaxKind.TypeLiteral,
			members: normalizeNode(node.members)
		};
		return result;
	}

	// Recursively copy properties, ignoring internal/positional ones
	for (const key of Object.keys(node)) {
		if (['pos', 'end', 'parent', 'flags', 'transformFlags', 'modifierFlagsCache', 'symbol', 'localSymbol', 'locals', 'nextContainer', 'flowNode', 'emitNode'].includes(key)) {
			continue;
		}
		
		if (key === 'text' && typeof node[key] === 'string') {
			const trimmed = node[key].trim();
			if (trimmed !== '') {
				result[key] = trimmed;
			}
		} else {
			const normalized = normalizeNode(node[key]);
			if (normalized !== null && (Array.isArray(normalized) ? normalized.length > 0 : true)) {
				result[key] = normalized;
			}
		}
	}

	return result;
}
