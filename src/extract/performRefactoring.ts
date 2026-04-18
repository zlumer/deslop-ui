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

	if (!decisions.extractChildren && ts.isJsxElement(node)) {
		// Add { children } to parameters
		parameters.push(
			ts.factory.createParameterDeclaration(
				undefined,
				undefined,
				ts.factory.createObjectBindingPattern([
					ts.factory.createBindingElement(undefined, undefined, 'children')
				])
			)
		);

		typeAnnotation = ts.factory.createTypeReferenceNode(
			ts.factory.createQualifiedName(
				ts.factory.createIdentifier('React'),
				ts.factory.createIdentifier('FC')
			),
			[
				ts.factory.createTypeReferenceNode(
					ts.factory.createQualifiedName(
						ts.factory.createIdentifier('React'),
						ts.factory.createIdentifier('PropsWithChildren')
					),
					undefined
				)
			]
		);

		// Replace children in the extracted component with {children}
		componentBody = ts.factory.updateJsxElement(
			node,
			node.openingElement,
			[ts.factory.createJsxExpression(undefined, ts.factory.createIdentifier('children'))],
			node.closingElement
		);

		// Create replacement AST that wraps the original children
		replacementAst = ts.factory.createJsxElement(
			ts.factory.createJsxOpeningElement(
				ts.factory.createIdentifier(componentName),
				undefined,
				ts.factory.createJsxAttributes([])
			),
			node.children,
			ts.factory.createJsxClosingElement(ts.factory.createIdentifier(componentName))
		);
	} else {
		typeAnnotation = ts.factory.createTypeReferenceNode(
			ts.factory.createQualifiedName(
				ts.factory.createIdentifier('React'),
				ts.factory.createIdentifier('FC')
			),
			undefined
		);

		// Create self-closing replacement AST
		replacementAst = ts.factory.createJsxSelfClosingElement(
			ts.factory.createIdentifier(componentName),
			undefined,
			ts.factory.createJsxAttributes([])
		);
	}

	// Create new component AST as a VariableStatement (const Component = () => ...)
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

	// Create text changes
	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
	const newComponentText = printer.printNode(ts.EmitHint.Unspecified, newComponentAst, sourceFile);
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
