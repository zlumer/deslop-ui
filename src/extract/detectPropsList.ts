import * as ts from 'typescript';
import { ExtractionCandidate, DecisionsRequest, PropCandidate } from './types';

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

	if (ts.isJsxElement(node) || ts.isJsxFragment(node))
	{
		childrenNodes = Array.from(node.children).filter(child => {
			if (ts.isJsxText(child)) {
				return child.text.trim().length > 0;
			}
			return true;
		});
		hasChildren = childrenNodes.length > 0;
	}

	const propsMap = new Map<string, PropCandidate>();

	function isDeclaredAtTopLevel(decl: ts.Node): boolean {
		let parent = decl.parent;
		while (parent && !ts.isSourceFile(parent)) {
			if (
				ts.isFunctionDeclaration(parent) ||
				ts.isArrowFunction(parent) ||
				ts.isFunctionExpression(parent) ||
				ts.isClassDeclaration(parent)
			) {
				return false; // Declared inside a function/class, so it's local
			}
			parent = parent.parent;
		}
		return true; // Reached the top level
	}

	function visit(n: ts.Node) {
		if (ts.isIdentifier(n)) {
			// Skip identifiers that are just property names or keys
			if (ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) return;
			if (ts.isPropertyAssignment(n.parent) && n.parent.name === n) return;
			if (ts.isJsxAttribute(n.parent) && n.parent.name === n) return;
			if (ts.isTypeReferenceNode(n.parent)) return;

			const symbol = typeChecker.getSymbolAtLocation(n);
			if (symbol && symbol.declarations && symbol.declarations.length > 0) {
				const decl = symbol.declarations[0];
				
				// Only consider variables declared in the same file
				if (decl.getSourceFile() === sourceFile) {
					// Check if declaration is outside the extracted node
					if (decl.getStart() < node.getStart() || decl.getEnd() > node.getEnd()) {
						// Check if it's a local variable (not top-level)
						if (!isDeclaredAtTopLevel(decl)) {
							const name = n.text;
							
							if (!propsMap.has(name)) {
								let typeNode: ts.TypeNode | undefined;
								try {
									const type = typeChecker.getTypeOfSymbolAtLocation(symbol, n);
									typeNode = typeChecker.typeToTypeNode(type, n, ts.NodeBuilderFlags.NoTruncation);
								} catch (e) {
									// Ignore type resolution errors
								}

								propsMap.set(name, {
									name,
									usageNodes: [n],
									typeNode,
									symbol
								});
							} else {
								propsMap.get(name)!.usageNodes.push(n);
							}
						}
					}
				}
			}
		}
		ts.forEachChild(n, visit);
	}

	visit(node);

	return {
		astData,
		props: Array.from(propsMap.values()),
		hasChildren,
		childrenNodes
	};
}
