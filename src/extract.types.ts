import * as ts from 'typescript';

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

// -----------------------------------------------------------------------
// STEP 1: Detect Components
// -----------------------------------------------------------------------

export interface ExtractionCandidate {
    /** The actual AST node found at the selection */
    node: ExtractableJsxNode;
    /** Human readable description (e.g., "<button className='btn-primary'>...") */
    description: string; 
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
    /** True to hardcode children in the new component, False to pass them as <Comp>{children}</Comp> */
    extractChildren: boolean;
    /** Which props the user actually decided to pass down */
    selectedProps: string[];
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
