import * as ts from 'typescript';
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
	let typeAnnotation: ts.TypeNode;

	const selectedProps = decisions.selectedProps || [];
	const hasProps = selectedProps.length > 0;
	const bindingElements: ts.BindingElement[] = [];
	const jsxAttributes: ts.JsxAttribute[] = [];

	// Extract key attribute if present
	let keyAttribute: ts.JsxAttribute | undefined;
	if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
		const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
		const keyAttr = attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.text === 'key') as ts.JsxAttribute | undefined;
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

	const hasChildren = !decisions.hardcodeChildren && ts.isJsxElement(node);

	if (hasChildren) {
		bindingElements.push(ts.factory.createBindingElement(undefined, undefined, 'children'));

		// Replace children in the extracted component with {children}
		componentBody = ts.factory.updateJsxElement(
			componentBody as ts.JsxElement,
			(componentBody as ts.JsxElement).openingElement,
			[ts.factory.createJsxExpression(undefined, ts.factory.createIdentifier('children'))],
			(componentBody as ts.JsxElement).closingElement
		);
	}

	if (bindingElements.length > 0) {
		parameters.push(
			ts.factory.createParameterDeclaration(
				undefined,
				undefined,
				ts.factory.createObjectBindingPattern(bindingElements)
			)
		);
	}

	// Determine type annotation
	const typeArgs: ts.TypeNode[] = [];
	if (hasProps) {
		typeArgs.push(ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(`${componentName}Props`), undefined));
	} else if (hasChildren) {
		typeArgs.push(
			ts.factory.createTypeReferenceNode(
				ts.factory.createQualifiedName(
					ts.factory.createIdentifier('React'),
					ts.factory.createIdentifier('PropsWithChildren')
				),
				undefined
			)
		);
	}

	typeAnnotation = ts.factory.createTypeReferenceNode(
		ts.factory.createQualifiedName(
			ts.factory.createIdentifier('React'),
			ts.factory.createIdentifier('FC')
		),
		typeArgs.length > 0 ? typeArgs : undefined
	);

	// Create replacement AST
	if (hasChildren) {
		replacementAst = ts.factory.createJsxElement(
			ts.factory.createJsxOpeningElement(
				ts.factory.createIdentifier(componentName),
				undefined,
				ts.factory.createJsxAttributes(jsxAttributes)
			),
			(node as ts.JsxElement).children,
			ts.factory.createJsxClosingElement(ts.factory.createIdentifier(componentName))
		);
	} else {
		replacementAst = ts.factory.createJsxSelfClosingElement(
			ts.factory.createIdentifier(componentName),
			undefined,
			ts.factory.createJsxAttributes(jsxAttributes)
		);
	}

	// Prevent leading comments from the original node from being printed in the new component
	ts.setEmitFlags(componentBody, ts.EmitFlags.NoLeadingComments);

	// Create new component AST
	const newComponentAst = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier(componentName),
					undefined,
					typeAnnotation,
					ts.factory.createArrowFunction(
						undefined,
						undefined,
						parameters,
						undefined,
						ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
						ts.factory.createParenthesizedExpression(componentBody)
					)
				)
			],
			ts.NodeFlags.Const
		)
	);

	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
	let newComponentText = '';

	// Generate Props Type Alias if needed
	if (hasProps) {
		const typeElements = selectedProps.map(propName => {
			const propCand = request.props.find(p => p.name === propName);
			const typeNode = propCand?.typeNode || ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
			return ts.factory.createPropertySignature(
				undefined,
				ts.factory.createIdentifier(propName),
				undefined,
				typeNode
			);
		});

		const typeAlias = ts.factory.createTypeAliasDeclaration(
			undefined,
			ts.factory.createIdentifier(`${componentName}Props`),
			undefined,
			ts.factory.createTypeLiteralNode(typeElements)
		);
		newComponentText += printer.printNode(ts.EmitHint.Unspecified, typeAlias, sourceFile) + '\n';
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

	return {
		textChanges,
		newComponentAst,
		replacementAst: replacementAst as any
	};
}
