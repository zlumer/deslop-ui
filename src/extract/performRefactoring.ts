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
			node as ts.JsxElement,
			(node as ts.JsxElement).openingElement,
			[ts.factory.createJsxExpression(undefined, ts.factory.createIdentifier('children'))],
			(node as ts.JsxElement).closingElement
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
						componentBody
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

	const textChanges: ts.TextChange[] = [
		{
			span: { start: node.getStart(sourceFile), length: node.getWidth(sourceFile) },
			newText: replacementText
		},
		{
			span: { start: 0, length: 0 },
			newText: newComponentText + '\n\n'
		}
	];

	return {
		textChanges,
		newComponentAst,
		replacementAst: replacementAst as any
	};
}
