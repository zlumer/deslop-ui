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

	function inferTypeFromUsage(usageNodes: ts.Identifier[]): ts.TypeNode | undefined {
		let isReactNode = false;
		let isPrimitive = false;
		let isArray = false;
		const properties = new Set<string>();
		let inferredTypeNode: ts.TypeNode | undefined;

		for (const n of usageNodes) {
			const parent = n.parent;
			if (ts.isJsxExpression(parent) && parent.parent && (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent))) {
				isReactNode = true;
			} else if (ts.isTemplateSpan(parent)) {
				isPrimitive = true;
			} else if (ts.isPropertyAccessExpression(parent) && parent.expression === n) {
				if (parent.name.text === 'map') {
					isArray = true;
				} else {
					properties.add(parent.name.text);
				}
			} else if (ts.isCallExpression(parent)) {
				const argIndex = parent.arguments.indexOf(n);
				if (argIndex !== -1) {
					const signature = typeChecker.getResolvedSignature(parent);
					if (signature && signature.parameters.length > argIndex) {
						const paramSymbol = signature.parameters[argIndex];
						const paramType = typeChecker.getTypeOfSymbolAtLocation(paramSymbol, parent);
						const typeNode = typeChecker.typeToTypeNode(paramType, parent, ts.NodeBuilderFlags.NoTruncation);
						if (typeNode && typeNode.kind !== ts.SyntaxKind.AnyKeyword) {
							inferredTypeNode = typeNode;
						}
					}
				}
			}
		}

		if (inferredTypeNode) return inferredTypeNode;

		if (properties.size > 0) {
			const members = Array.from(properties).map(prop => 
				ts.factory.createPropertySignature(
					undefined,
					ts.factory.createIdentifier(prop),
					undefined,
					ts.factory.createTypeReferenceNode(
						ts.factory.createQualifiedName(
							ts.factory.createIdentifier("React"),
							ts.factory.createIdentifier("ReactNode")
						),
						undefined
					)
				)
			);
			return ts.factory.createTypeLiteralNode(members);
		}

		if (isArray) {
			return ts.factory.createArrayTypeNode(ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword));
		}

		if (isPrimitive) {
			return ts.factory.createUnionTypeNode([
				ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
				ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
				ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword)
			]);
		}

		if (isReactNode) {
			return ts.factory.createTypeReferenceNode(
				ts.factory.createQualifiedName(
					ts.factory.createIdentifier("React"),
					ts.factory.createIdentifier("ReactNode")
				),
				undefined
			);
		}

		return undefined;
	}

	for (const prop of propsMap.values()) {
		if (!prop.typeNode || prop.typeNode.kind === ts.SyntaxKind.AnyKeyword) {
			const inferred = inferTypeFromUsage(prop.usageNodes);
			if (inferred) {
				prop.typeNode = inferred;
			}
		}
	}

	return {
		astData,
		props: Array.from(propsMap.values()),
		hasChildren,
		childrenNodes
	};
}
