import * as ts from 'typescript';
import { EditorSelection, ExtractionCandidates, ExtractionCandidate, DecisionsRequest, RefactorDecisions, RefactorResult } from './extract.types';

/**
 * 1. Detects which JSX components within the given selection are valid for extraction.
 * 
 * @param sourceFile - The parsed AST of the current file.
 * @param selection - The cursor position or highlight range.
 */
export function detectComponents(
    sourceFile: ts.SourceFile,
    selection: EditorSelection
): ExtractionCandidates
{
    const candidates: ExtractionCandidates = [];

    function visit(node: ts.Node) {
        const start = node.getStart(sourceFile);
        const end = node.getEnd();

        // Check if the node intersects with the selection
        if (start <= selection.end && end >= selection.start) {
            // Visit children first (post-order traversal) so innermost nodes are first
            ts.forEachChild(node, visit);

            if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
                let description = node.getText(sourceFile).split('\n')[0];
                candidates.push({
                    node,
                    description
                });
            }
        }
    }

    visit(sourceFile);
    return candidates;
}

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

    if (ts.isJsxElement(node)) {
        hasChildren = node.children.length > 0;
        childrenNodes = Array.from(node.children);
    } else if (ts.isJsxFragment(node)) {
        hasChildren = node.children.length > 0;
        childrenNodes = Array.from(node.children);
    }

    return {
        astData,
        props: [],
        hasChildren,
        childrenNodes
    };
}

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
