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
	// Implementation would involve traversing the AST to find JSX nodes that intersect with the selection
	throw new Error('Not implemented yet');
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
	throw new Error('Not implemented yet');
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
	throw new Error('Not implemented yet');
}