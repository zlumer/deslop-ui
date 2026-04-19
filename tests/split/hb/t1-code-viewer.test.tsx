import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupHyperbranchFixture, cleanupHyperbranchFixture } from './fixture';
import { detectComponents } from '../../../src/extract/detectComponents';
import { detectPropsList } from '../../../src/extract/detectPropsList';
import { performRefactoring } from '../../../src/extract/performRefactoring';
import { applyTextChanges } from '../../../src/extract/applyTextChanges';
import { equals } from '../../../src/fuzzy';
import { prepareTS } from '../utils';

describe('Hyperbranch t1-code-viewer', () => {
    let frontendDir: string;
    let baseTempDir: string;

    beforeAll(() => {
        frontendDir = setupHyperbranchFixture();
        baseTempDir = path.resolve(frontendDir, '..');
    });

    afterAll(() => {
        cleanupHyperbranchFixture(baseTempDir);
    });

    it('should refactor code-viewer.tsx to match t1-code-viewer.txt', () => {
        const filePath = path.join(frontendDir, 'src/features/workspace/code-viewer.tsx');
        let sourceCode = fs.readFileSync(filePath, 'utf-8');
        const expectedCode = fs.readFileSync(path.join(__dirname, 't1-code-viewer.txt'), 'utf-8');

        function runExtraction(
            start: number,
            end: number,
            componentName: string,
            selectedProps: string[],
            extractChildren: boolean
        ) {
            const { sourceFile, typeChecker } = prepareTS(sourceCode);
            const candidates = detectComponents(sourceFile, { start, end });
            
            if (!candidates || candidates.length === 0) {
                throw new Error(`No components detected for ${componentName} between ${start} and ${end}`);
            }
            
            const astData = candidates[0];
            const request = detectPropsList(sourceFile, typeChecker, astData);
            
            const childrenReplacementNodes = extractChildren && ts.isJsxElement(astData.node)
                ? Array.from(astData.node.children)
                : undefined;

            const decisions = {
                componentName,
                selectedProps,
                childrenReplacementNodes
            };
            
            const result = performRefactoring(sourceFile, request, decisions);
            sourceCode = applyTextChanges(sourceCode, result.textChanges);
        }

        // 1. Extract FileSelector
        let start = sourceCode.indexOf('<div className="h-full flex items-center justify-center text-gray-400">');
        let end = sourceCode.indexOf('</div>', start) + 6;
        runExtraction(start, end, 'FileSelector', [], true);

        // 2. Extract Loading
        start = sourceCode.indexOf('<div className="p-8 text-gray-500">');
        end = sourceCode.indexOf('</div>', start) + 6;
        runExtraction(start, end, 'Loading', [], false);

        // 3. Extract ErrorMessage
        start = sourceCode.indexOf('<div className="p-8 text-red-500">');
        end = sourceCode.indexOf('</div>', start) + 6;
        runExtraction(start, end, 'ErrorMessage', [], true);

        // 4. Extract CodeViewerView
        start = sourceCode.indexOf('<div className="h-full overflow-auto bg-white">');
        end = sourceCode.lastIndexOf('</div>') + 6;
        runExtraction(start, end, 'CodeViewerView', ['path', 'content'], false);

        // Verify the final refactored code matches the expected output
        const isMatch = equals(sourceCode, expectedCode);
        if (!isMatch) {
            console.log("--- ACTUAL SOURCE ---");
            console.log(sourceCode);
            console.log("--- EXPECTED SOURCE ---");
            console.log(expectedCode);
        }
        
        expect(isMatch).toBe(true);
    });
});
