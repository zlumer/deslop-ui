import { describe, expect } from 'vitest';
import * as ts from 'typescript';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';
import { sft } from './utils';

const INPUT_CODE = `import { useState } from 'react';

export const SearchPage = () => {
  const [query, setQuery] = useState("");

  return (
    <div>
      {/* Target: Extract <input> into \`SearchBar\` */}
      <h1>Search</h1>
      <input 
        type="text" 
        value={query} 
        onChange={(e) => setQuery(e.target.value)} 
        placeholder="Type to search..." 
      />
    </div>
  );
};`;

const OUTPUT_CODE = `import { useState, Dispatch, SetStateAction } from 'react';

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void
}

const SearchBar: React.FC<SearchBarProps> = ({ query, setQuery }) => (
  <input 
    type="text" 
    value={query} 
    onChange={(e) => setQuery(e.target.value)} 
    placeholder="Type to search..." 
  />
);

export const SearchPage = () => {
  const [query, setQuery] = useState("");

  return (
    <div>
      {/* Target: Extract <input> into \`SearchBar\` */}
      <h1>Search</h1>
      <SearchBar query={query} setQuery={setQuery} />
    </div>
  );
};`;

describe('[6-event-set-state]', () =>
{
	sft('should extract <input> into SearchBar and type state setters', INPUT_CODE, OUTPUT_CODE, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) =>
	{
		// Find the text offsets for: <input ... />
		const inputStart = inputCode.lastIndexOf('<input');
		const inputEnd = inputCode.indexOf('/>', inputStart) + '/>'.length;
		const selection = { start: inputStart, end: inputEnd };

		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection);
		
		// Assertions for Step 1
		expect(candidates.length).toBeGreaterThanOrEqual(1);
		const inputCandidate = candidates.find(c => c.description.includes('<input'))!;
		expect(inputCandidate).toBeDefined();
		expect(inputCandidate.node.kind).toBe(ts.SyntaxKind.JsxSelfClosingElement);
		expect(inputCandidate.description).toContain('<input');

		// -------------------------------------------------------------------
		// STEP 2: Detect Props and Context
		// -------------------------------------------------------------------
		const decisionsRequest = detectPropsList(
			sourceFile,
			typeChecker,
			inputCandidate
		);

		// Assertions for Step 2
		// Since the <input> uses external variables `query` and `setQuery`, props should be detected
		expect(decisionsRequest.props).toHaveLength(2);
		expect(decisionsRequest.props.map(p => p.name)).toEqual(expect.arrayContaining(['query', 'setQuery']));
		expect(decisionsRequest.hasChildren).toBe(false);

		// -------------------------------------------------------------------
		// STEP 3: Perform Refactor
		// -------------------------------------------------------------------
		const decisions = {
			componentName: 'SearchBar',
			selectedProps: ['query', 'setQuery'], // Pass detected props
			childrenReplacementNodes: [] // No children to pass
		} satisfies RefactorDecisions;

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		);

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const SearchBar = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxSelfClosingElement); // <SearchBar />

		return result;
	});
});
