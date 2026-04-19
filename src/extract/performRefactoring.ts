import * as ts from 'typescript';
import { Project } from "ts-morph";
import { DecisionsRequest, RefactorDecisions, RefactorResult, PropCandidate } from './types';

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
): RefactorResult {
	const componentName = decisions.componentName;
	const node = request.astData.node;
	const selectedProps = decisions.selectedProps || [];
	const hasProps = selectedProps.length > 0;
	const hasChildren = decisions.childrenReplacementNodes !== undefined && decisions.childrenReplacementNodes.length > 0;

	let componentBody = node as ts.Expression;
	const parameters: ts.ParameterDeclaration[] = [];
	const bindingElements: ts.BindingElement[] = [];
	const jsxAttributes: ts.JsxAttribute[] = [];

	// 1. Extract key attribute
	const keyResult = extractKeyAttribute(node, componentBody);
	componentBody = keyResult.componentBody;
	if (keyResult.keyAttribute) {
		jsxAttributes.push(keyResult.keyAttribute);
	}

	// 2. Handle props
	if (hasProps) {
		buildProps(selectedProps, bindingElements, jsxAttributes);
	}

	// 3. Handle children
	if (hasChildren) {
		bindingElements.push(ts.factory.createBindingElement(undefined, undefined, 'children'));
		componentBody = transformChildren(componentBody, decisions.childrenReplacementNodes!);
	}

	// 4. Build parameters
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

	// 5. Create replacement AST
	const replacementAst = createReplacementAst(
		componentName,
		jsxAttributes,
		hasChildren,
		decisions.childrenReplacementNodes
	);

	// 6. Clean component body (drop leading comments)
	componentBody = cleanComponentBody(componentBody);

	// 7. Create component type
	const componentType = createComponentType(componentName, hasProps, hasChildren);

	// 8. Create new component AST
	const newComponentAst = createNewComponentAst(componentName, componentType, parameters, componentBody);

	// 9. Generate text and types
	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
	let newComponentText = '';
	let usesDispatch = false;

	if (hasProps) {
		const typeAliasResult = generatePropsTypeAlias(componentName, selectedProps, request.props);
		usesDispatch = typeAliasResult.usesDispatch;
		newComponentText += printer.printNode(ts.EmitHint.Unspecified, typeAliasResult.typeAliasDecl, sourceFile) + '\n\n';
	}

	newComponentText += printer.printNode(ts.EmitHint.Unspecified, newComponentAst, sourceFile);
	const replacementText = printer.printNode(ts.EmitHint.Unspecified, replacementAst, sourceFile);

	// 10. Calculate text changes
	const textChanges = calculateTextChanges(sourceFile, node, replacementText, newComponentText);

	// 11. Update React imports if needed
	if (usesDispatch) {
		updateReactImports(sourceFile, textChanges);
	}

	return {
		textChanges,
		newComponentAst,
		replacementAst: replacementAst as any
	};
}

// --- Helper Functions ---

function extractKeyAttribute(node: ts.Node, componentBody: ts.Expression) {
	let keyAttribute: ts.JsxAttribute | undefined;

	if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) {
		return { keyAttribute, componentBody };
	}

	const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
	const keyAttr = attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText() === 'key') as ts.JsxAttribute | undefined;
	
	if (!keyAttr) {
		return { keyAttribute, componentBody };
	}

	keyAttribute = keyAttr;
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

	return { keyAttribute, componentBody };
}

function buildProps(selectedProps: string[], bindingElements: ts.BindingElement[], jsxAttributes: ts.JsxAttribute[]) {
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

function transformChildren(componentBody: ts.Expression, replacementNodes: ts.JsxChild[]): ts.Expression {
	const transformer = (context: ts.TransformationContext) => (rootNode: ts.Node) => {
		function visitor(n: ts.Node): ts.Node {
			if (!ts.isJsxElement(n) && !ts.isJsxFragment(n)) {
				return ts.visitEachChild(n, visitor, context);
			}

			const originalChildren = ts.isJsxElement(n) ? n.children : n.children;
			const hasReplacement = originalChildren.some(child => replacementNodes.includes(child));
			
			if (!hasReplacement) {
				return ts.visitEachChild(n, visitor, context);
			}

			const newChildren: ts.JsxChild[] = [];
			let i = 0;
			while (i < originalChildren.length) {
				const child = originalChildren[i];
				if (replacementNodes.includes(child)) {
					newChildren.push(ts.factory.createJsxExpression(undefined, ts.factory.createIdentifier('children')));
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
		return ts.visitNode(rootNode, visitor);
	};

	const result = ts.transform(componentBody, [transformer]);
	return result.transformed[0] as ts.Expression;
}

function createReplacementAst(
	componentName: string,
	jsxAttributes: ts.JsxAttribute[],
	hasChildren: boolean,
	childrenReplacementNodes?: ts.JsxChild[]
) {
	if (hasChildren && childrenReplacementNodes) {
		return ts.factory.createJsxElement(
			ts.factory.createJsxOpeningElement(
				ts.factory.createIdentifier(componentName),
				undefined,
				ts.factory.createJsxAttributes(jsxAttributes)
			),
			childrenReplacementNodes,
			ts.factory.createJsxClosingElement(ts.factory.createIdentifier(componentName))
		);
	}

	return ts.factory.createJsxSelfClosingElement(
		ts.factory.createIdentifier(componentName),
		undefined,
		ts.factory.createJsxAttributes(jsxAttributes)
	);
}

function cleanComponentBody(componentBody: ts.Expression): ts.Expression {
	if (ts.isJsxFragment(componentBody)) {
		return ts.factory.createJsxFragment(
			componentBody.openingFragment,
			componentBody.children,
			componentBody.closingFragment
		);
	}
	if (ts.isJsxElement(componentBody)) {
		return ts.factory.createJsxElement(
			componentBody.openingElement,
			componentBody.children,
			componentBody.closingElement
		);
	}
	if (ts.isJsxSelfClosingElement(componentBody)) {
		return ts.factory.createJsxSelfClosingElement(
			componentBody.tagName,
			componentBody.typeArguments,
			componentBody.attributes
		);
	}
	return componentBody;
}

function createReactFCType(typeArgument: ts.TypeNode): ts.TypeReferenceNode {
	return ts.factory.createTypeReferenceNode(
		ts.factory.createQualifiedName(
			ts.factory.createIdentifier('React'),
			ts.factory.createIdentifier('FC')
		),
		[typeArgument]
	);
}

function createComponentType(componentName: string, hasProps: boolean, hasChildren: boolean): ts.TypeNode | undefined {
	if (hasProps) {
		return createReactFCType(
			ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(`${componentName}Props`), undefined)
		);
	}
	if (hasChildren) {
		return createReactFCType(
			ts.factory.createTypeReferenceNode(
				ts.factory.createQualifiedName(
					ts.factory.createIdentifier('React'),
					ts.factory.createIdentifier('PropsWithChildren')
				),
				undefined
			)
		);
	}
	return undefined;
}

function createNewComponentAst(
	componentName: string,
	componentType: ts.TypeNode | undefined,
	parameters: ts.ParameterDeclaration[],
	componentBody: ts.Expression
) {
	return ts.factory.createVariableStatement(
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
}

function generatePropsTypeAlias(componentName: string, selectedProps: string[], requestProps: PropCandidate[]) {
	let usesDispatch = false;

	const typeElements = selectedProps.map(propName => {
		const propCand = requestProps.find(p => p.name === propName);
		let typeNode = propCand?.typeNode || ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
		
		typeNode = ts.visitNode(typeNode, function visitor(n: ts.Node): ts.Node {
			const dispatchType = tryTransformDispatchType(n, visitor, propName);
			if (dispatchType) {
				usesDispatch = true;
				return dispatchType;
			}

			if (ts.isImportTypeNode(n) && n.qualifier && ts.isIdentifier(n.qualifier)) {
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

	return { typeAliasDecl, usesDispatch };
}

function tryTransformDispatchType(n: ts.Node, visitor: ts.Visitor, propName: string): ts.TypeNode | undefined {
	if (!ts.isImportTypeNode(n) || !n.qualifier || !ts.isIdentifier(n.qualifier)) return undefined;
	if (n.qualifier.text !== 'Dispatch') return undefined;
	
	const typeArgs = n.typeArguments;
	if (!typeArgs || typeArgs.length !== 1) return undefined;
	
	const arg = typeArgs[0];
	if (!ts.isImportTypeNode(arg) || !arg.qualifier || !ts.isIdentifier(arg.qualifier) || arg.qualifier.text !== 'SetStateAction') return undefined;
	
	const innerTypeArgs = arg.typeArguments;
	if (!innerTypeArgs || innerTypeArgs.length !== 1) return undefined;
	
	const innerType = innerTypeArgs[0];
	let paramName = propName;
	if (paramName.startsWith('set') && paramName.length > 3) {
		paramName = paramName.charAt(3).toLowerCase() + paramName.slice(4);
	}
	
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

function calculateTextChanges(sourceFile: ts.SourceFile, node: ts.Node, replacementText: string, newComponentText: string): ts.TextChange[] {
	let topLevelStatement: ts.Node = node;
	while (topLevelStatement.parent && !ts.isSourceFile(topLevelStatement.parent)) {
		topLevelStatement = topLevelStatement.parent;
	}
	const insertPos = topLevelStatement.getStart(sourceFile);

	return [
		{
			span: { start: node.getStart(sourceFile), length: node.getWidth(sourceFile) },
			newText: replacementText
		},
		{
			span: { start: insertPos, length: 0 },
			newText: newComponentText + '\n'
		}
	];
}

function updateReactImports(sourceFile: ts.SourceFile, textChanges: ts.TextChange[]) {
	const project = new Project({ useInMemoryFileSystem: true });
	const sf = project.createSourceFile('temp.tsx', sourceFile.getFullText());
	const reactImport = sf.getImportDeclaration(decl => decl.getModuleSpecifierValue() === 'react');
	
	if (!reactImport) return;

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
