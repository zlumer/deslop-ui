import * as ts from 'typescript';
import { Project } from "ts-morph";
import { DecisionsRequest, RefactorDecisions, RefactorResult } from './types';

/**
 * 3. Performs the actual AST manipulation to extract the component and replace
 * the original code with a reference to the new component.
 *
 * @param sourceFile - The parsed AST of the current file.
 * @param request - The analyzed data from Step 2.
 * @param decisions - The configuration decided by the user/system.
 */

export function performRefactoring(
	sourceFile: ts.SourceFile,
	request: DecisionsRequest,
	decisions: RefactorDecisions
): RefactorResult
{
	const componentName = decisions.componentName;
	const node = request.astData.node;

	let componentBody = node as ts.Expression;
	let replacementAst: ts.JsxElement | ts.JsxSelfClosingElement;
	const parameters: ts.ParameterDeclaration[] = [];

	const selectedProps = decisions.selectedProps || [];
	const hasProps = selectedProps.length > 0;
	const bindingElements: ts.BindingElement[] = [];
	const jsxAttributes: ts.JsxAttribute[] = [];

	// Extract key attribute if present
	let keyAttribute: ts.JsxAttribute | undefined;
	if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
		const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
		const keyAttr = attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText() === 'key') as ts.JsxAttribute | undefined;
		if (keyAttr) {
			keyAttribute = keyAttr;
			
			// Remove key from componentBody
			const newAttributes = ts.factory.createJsxAttributes(
				attributes.properties.filter(p => p !== keyAttr)
			);
			
			if (ts.isJsxElement(node)) {
				componentBody = ts.factory.updateJsxElement(
					node,
					ts.factory.updateJsxOpeningElement(
						node.openingElement,
						node.openingElement.tagName,
						node.openingElement.typeArguments,
						newAttributes
					),
					node.children,
					node.closingElement
				);
			} else {
				componentBody = ts.factory.updateJsxSelfClosingElement(
					node,
					node.tagName,
					node.typeArguments,
					newAttributes
				);
			}
		}
	}

	if (keyAttribute) {
		jsxAttributes.push(keyAttribute);
	}

	// Handle props
	if (hasProps) {
		for (const propName of selectedProps) {
			bindingElements.push(ts.factory.createBindingElement(undefined, undefined, propName));
			jsxAttributes.push(
				ts.factory.createJsxAttribute(
					ts.factory.createIdentifier(propName),
					ts.factory.createJsxExpression(undefined, ts.factory.createIdentifier(propName))
				)
			);
		}
	}

	const hasChildren = decisions.childrenReplacementNodes !== undefined && decisions.childrenReplacementNodes.length > 0;

	if (hasChildren) {
		bindingElements.push(ts.factory.createBindingElement(undefined, undefined, 'children'));

		const replacementNodes = decisions.childrenReplacementNodes!;
		
		const transformer = (context: ts.TransformationContext) => (rootNode: ts.Node) => {
			function visitor(n: ts.Node): ts.Node {
				if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
					const originalChildren = ts.isJsxElement(n) ? n.children : n.children;
					let hasReplacement = false;
					for (const child of originalChildren) {
						if (replacementNodes.includes(child)) {
							hasReplacement = true;
							break;
						}
					}
					
					if (hasReplacement) {
						const newChildren: ts.JsxChild[] = [];
						let i = 0;
						while (i < originalChildren.length) {
							const child = originalChildren[i];
							if (replacementNodes.includes(child)) {
								// Insert {children} once for the contiguous block
								newChildren.push(ts.factory.createJsxExpression(undefined, ts.factory.createIdentifier('children')));
								// Skip all nodes that are in replacementNodes
								while (i < originalChildren.length && replacementNodes.includes(originalChildren[i])) {
									i++;
								}
							} else {
								newChildren.push(ts.visitNode(child, visitor) as ts.JsxChild);
								i++;
							}
						}
						
						if (ts.isJsxElement(n)) {
							return ts.factory.updateJsxElement(
								n,
								ts.visitNode(n.openingElement, visitor) as ts.JsxOpeningElement,
								newChildren,
								ts.visitNode(n.closingElement, visitor) as ts.JsxClosingElement
							);
						} else {
							return ts.factory.updateJsxFragment(
								n,
								ts.visitNode(n.openingFragment, visitor) as ts.JsxOpeningFragment,
								newChildren,
								ts.visitNode(n.closingFragment, visitor) as ts.JsxClosingFragment
							);
						}
					}
				}
				return ts.visitEachChild(n, visitor, context);
			}
			return ts.visitNode(rootNode, visitor);
		};

		const result = ts.transform(componentBody, [transformer]);
		componentBody = result.transformed[0] as ts.Expression;
	}

	if (bindingElements.length > 0) {
		parameters.push(
			ts.factory.createParameterDeclaration(
				undefined,
				undefined,
				ts.factory.createObjectBindingPattern(bindingElements),
				undefined,
				undefined
			)
		);
	}

	// Create replacement AST
	if (hasChildren) {
		replacementAst = ts.factory.createJsxElement(
			ts.factory.createJsxOpeningElement(
				ts.factory.createIdentifier(componentName),
				undefined,
				ts.factory.createJsxAttributes(jsxAttributes)
			),
			decisions.childrenReplacementNodes!,
			ts.factory.createJsxClosingElement(ts.factory.createIdentifier(componentName))
		);
	} else {
		replacementAst = ts.factory.createJsxSelfClosingElement(
			ts.factory.createIdentifier(componentName),
			undefined,
			ts.factory.createJsxAttributes(jsxAttributes)
		);
	}

	// Recreate the root node to drop leading comments from the original AST location
	if (ts.isJsxFragment(componentBody)) {
		componentBody = ts.factory.createJsxFragment(
			componentBody.openingFragment,
			componentBody.children,
			componentBody.closingFragment
		);
	} else if (ts.isJsxElement(componentBody)) {
		componentBody = ts.factory.createJsxElement(
			componentBody.openingElement,
			componentBody.children,
			componentBody.closingElement
		);
	} else if (ts.isJsxSelfClosingElement(componentBody)) {
		componentBody = ts.factory.createJsxSelfClosingElement(
			componentBody.tagName,
			componentBody.typeArguments,
			componentBody.attributes
		);
	}

	let componentType: ts.TypeNode | undefined;
	if (hasProps) {
		componentType = ts.factory.createTypeReferenceNode(
			ts.factory.createQualifiedName(
				ts.factory.createIdentifier('React'),
				ts.factory.createIdentifier('FC')
			),
			[ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(`${componentName}Props`), undefined)]
		);
	} else if (hasChildren) {
		componentType = ts.factory.createTypeReferenceNode(
			ts.factory.createQualifiedName(
				ts.factory.createIdentifier('React'),
				ts.factory.createIdentifier('FC')
			),
			[ts.factory.createTypeReferenceNode(
				ts.factory.createQualifiedName(
					ts.factory.createIdentifier('React'),
					ts.factory.createIdentifier('PropsWithChildren')
				),
				undefined
			)]
		);
	}

	// Create new component AST
	const newComponentAst = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier(componentName),
					undefined,
					componentType,
					ts.factory.createArrowFunction(
						undefined,
						undefined,
						parameters,
						undefined,
						ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
						componentBody
					)
				)
			],
			ts.NodeFlags.Const
		)
	);

	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
	let newComponentText = '';
	let usesDispatch = false;

	// Generate Props Type Alias if needed
	if (hasProps) {
		const typeElements = selectedProps.map(propName => {
			const propCand = request.props.find(p => p.name === propName);
			let typeNode = propCand?.typeNode || ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
			
			typeNode = ts.visitNode(typeNode, function visitor(n: ts.Node): ts.Node {
				if (ts.isImportTypeNode(n) && n.qualifier && ts.isIdentifier(n.qualifier)) {
					if (n.qualifier.text === 'Dispatch') {
						const typeArgs = n.typeArguments;
						if (typeArgs && typeArgs.length === 1) {
							const arg = typeArgs[0];
							if (ts.isImportTypeNode(arg) && arg.qualifier && ts.isIdentifier(arg.qualifier) && arg.qualifier.text === 'SetStateAction') {
								const innerTypeArgs = arg.typeArguments;
								if (innerTypeArgs && innerTypeArgs.length === 1) {
									const innerType = innerTypeArgs[0];
									let paramName = propName;
									if (paramName.startsWith('set') && paramName.length > 3) {
										paramName = paramName.charAt(3).toLowerCase() + paramName.slice(4);
									}
									usesDispatch = true;
									return ts.factory.createFunctionTypeNode(
										undefined,
										[ts.factory.createParameterDeclaration(
											undefined,
											undefined,
											ts.factory.createIdentifier(paramName),
											undefined,
											ts.visitNode(innerType, visitor) as ts.TypeNode
										)],
										ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword)
									);
								}
							}
						}
					}
					return ts.factory.createTypeReferenceNode(n.qualifier, n.typeArguments?.map(t => ts.visitNode(t, visitor) as ts.TypeNode));
				}
				return ts.visitEachChild(n, visitor, undefined);
			}) as ts.TypeNode;

			return ts.factory.createPropertySignature(
				undefined,
				ts.factory.createIdentifier(propName),
				undefined,
				typeNode
			);
		});

		const typeAliasDecl = ts.factory.createTypeAliasDeclaration(
			undefined,
			ts.factory.createIdentifier(`${componentName}Props`),
			undefined,
			ts.factory.createTypeLiteralNode(typeElements)
		);
		newComponentText += printer.printNode(ts.EmitHint.Unspecified, typeAliasDecl, sourceFile) + '\n\n';
	}

	newComponentText += printer.printNode(ts.EmitHint.Unspecified, newComponentAst, sourceFile);
	const replacementText = printer.printNode(ts.EmitHint.Unspecified, replacementAst, sourceFile);

	// Find the top-level statement containing the node to insert the new component before it
	let topLevelStatement: ts.Node = node;
	while (topLevelStatement.parent && !ts.isSourceFile(topLevelStatement.parent)) {
		topLevelStatement = topLevelStatement.parent;
	}
	const insertPos = topLevelStatement.getStart(sourceFile);

	const textChanges: ts.TextChange[] = [
		{
			span: { start: node.getStart(sourceFile), length: node.getWidth(sourceFile) },
			newText: replacementText
		},
		{
			span: { start: insertPos, length: 0 },
			newText: newComponentText + '\n'
		}
	];

	// Find react import and add Dispatch, SetStateAction if needed using ts-morph
	if (usesDispatch) {
		const project = new Project({ useInMemoryFileSystem: true });
		const sf = project.createSourceFile('temp.tsx', sourceFile.getFullText());
		const reactImport = sf.getImportDeclaration(decl => decl.getModuleSpecifierValue() === 'react');
		
		if (reactImport) {
			let changed = false;
			const namedImports = reactImport.getNamedImports().map(ni => ni.getName());
			
			if (!namedImports.includes('Dispatch')) {
				reactImport.addNamedImport('Dispatch');
				changed = true;
			}
			if (!namedImports.includes('SetStateAction')) {
				reactImport.addNamedImport('SetStateAction');
				changed = true;
			}
			
			if (changed) {
				const originalImport = sourceFile.statements.find(stmt => 
					ts.isImportDeclaration(stmt) && 
					ts.isStringLiteral(stmt.moduleSpecifier) && 
					stmt.moduleSpecifier.text === 'react'
				);
				
				if (originalImport) {
					textChanges.push({
						span: { start: originalImport.getStart(sourceFile), length: originalImport.getWidth(sourceFile) },
						newText: reactImport.getText()
					});
				}
			}
		}
	}

	return {
		textChanges,
		newComponentAst,
		replacementAst: replacementAst as any
	};
}
