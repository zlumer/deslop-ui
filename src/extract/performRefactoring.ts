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

	// Create new component AST as a VariableStatement (const Component = () => ...)
	const newComponentAst = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier(componentName),
					undefined,
					undefined,
					ts.factory.createArrowFunction(
						undefined,
						undefined,
						[],
						undefined,
						ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
						node as ts.Expression
					)
				)
			],
			ts.NodeFlags.Const
		)
	);

	// Create replacement AST
	const replacementAst = ts.factory.createJsxSelfClosingElement(
		ts.factory.createIdentifier(componentName),
		undefined,
		ts.factory.createJsxAttributes([])
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
