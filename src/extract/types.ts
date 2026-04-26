import * as ts from 'typescript';
import { ComponentComplexity } from './scoreComponentComplexity';

// -----------------------------------------------------------------------
// Common AST Types & Helpers
// -----------------------------------------------------------------------

/**
 * Represents the valid JSX nodes that can be extracted into a new component.
 */
export type ExtractableJsxNode = 
  | ts.JsxElement 
  | ts.JsxSelfClosingElement 
  | ts.JsxFragment;

/**
 * Represents the user's cursor or highlight selection in the editor.
 */
export interface EditorSelection {
    start: number;
    end: number;
}

export type FileCursorPositionInput = number | `${number}:${number}`
export type FileCursorPositionFull = {
	index: number
	line: number
	character: number
}

// -----------------------------------------------------------------------
// STEP 1: Detect Components
// -----------------------------------------------------------------------

export interface ExtractionCandidate {
    /** The actual AST node found at the selection */
    node: ExtractableJsxNode;
    /** Human readable description (e.g., "<button className='btn-primary'>...") */
    description: string;
	/** Unique tag for this candidate (used for correlating decisions) */
	tag: string;
	/** The start offset of the node in the source file */
	start: FileCursorPositionFull;
	/** The end offset of the node in the source file */
	end: FileCursorPositionFull;
	/** The calculated complexity score of the component */
	complexity: Record<string, number>;
}

export type ExtractionCandidates = ExtractionCandidate[];

// -----------------------------------------------------------------------
// STEP 2: Detect Props and Context (Decisions Request)
// -----------------------------------------------------------------------

export interface PropCandidate {
    /** The inferred name of the prop based on local variable names */
    name: string;
    /** The AST identifier nodes where this variable is referenced inside the JSX */
    usageNodes: ts.Identifier[];
    /** The inferred TypeScript AST TypeNode for this prop (if determinable) */
    typeNode?: ts.TypeNode;
    /** The original declaration symbol (helps determine if it's state, function, etc.) */
    symbol?: ts.Symbol;
}

export interface DecisionsRequest {
    /** The AST data passed from the selection in Step 1 */
    astData: ExtractionCandidate;
    /** Dependencies from the outer scope used inside the node (need to be props) */
    props: PropCandidate[];
    /** Whether the selected node has JSX children */
    hasChildren: boolean;
    /** The AST nodes of the children (text, expressions, other elements) */
    childrenNodes: ts.JsxChild[];
}

// -----------------------------------------------------------------------
// STEP 3: Perform Refactor
// -----------------------------------------------------------------------

export interface RefactorDecisions {
    /** The name for the new component (e.g., "SubmitButton") */
    componentName: string;
    /** Which props the user actually decided to pass down */
    selectedProps: string[];
	/** 
     * The specific descendant nodes to be extracted as children.
     * These contiguous sibling nodes will be replaced with `{children}` in the extracted component,
     * and will be passed as children to the new component instance.
     */
    childrenReplacementNodes: ts.JsxChild[];
}

export interface RefactorResult {
    /** 
     * Standard TS compiler text changes to be applied to the document. 
     * Includes both inserting the new component and replacing the old code.
     */
    textChanges: ts.TextChange[];
    /** The newly generated component AST node (for reference/further manipulation) */
    newComponentAst: ts.VariableStatement | ts.FunctionDeclaration;
    /** The updated JSX element AST node that replaces the original selection */
    replacementAst: ExtractableJsxNode;
}
