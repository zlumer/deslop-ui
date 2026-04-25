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

describe('Hyperbranch t2-task-details', () => {
    let frontendDir: string;
    let baseTempDir: string;

    beforeAll(() => {
        frontendDir = setupHyperbranchFixture();
        baseTempDir = path.resolve(frontendDir, '..');
    }, 60000);

    afterAll(() => {
        cleanupHyperbranchFixture(baseTempDir);
    });

    it('should refactor TaskDetailsPage to match t2-task-details.txt', () => {
        const filePath = path.join(frontendDir, 'src/pages/TaskDetailsPage.tsx');
        
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found at ${filePath}, please adjust the path in the test.`);
            return;
        }

        let sourceCode = fs.readFileSync(filePath, 'utf-8');
        let expectedCode = fs.readFileSync(path.join(__dirname, 't2-task-details.txt'), 'utf-8');

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
            
            // Sort candidates by size descending to pick the outermost node that fits the range
            candidates.sort((a, b) => (b.node.getEnd() - b.node.getStart()) - (a.node.getEnd() - a.node.getStart()));
            const astData = candidates[0];
            
            const request = detectPropsList(sourceFile, typeChecker, astData);
            
            const childrenReplacementNodes = extractChildren && ts.isJsxElement(astData.node)
                ? Array.from(astData.node.children)
                : [];

            const decisions = {
                componentName,
                selectedProps,
                childrenReplacementNodes
            };
            
            const result = performRefactoring(sourceFile, request, decisions as any);
            sourceCode = applyTextChanges(sourceCode, result.textChanges);
        }

        // 1. Extract TaskHeader
        let start = sourceCode.indexOf('<div className="mb-6">');
        // Find the start of the next sibling div to safely encapsulate the entire mb-6 div
        let end = sourceCode.indexOf('<div>\n        <div className="flex justify-between items-center mb-4">');
        
        runExtraction(start, end, 'TaskHeader', ['task'], false);

        // Verify the final refactored code matches the expected output
        const isMatch = equals(sourceCode, expectedCode);
        if (!isMatch) {
            console.log("--- ACTUAL SOURCE ---");
            console.log(sourceCode);
            console.log("--- EXPECTED SOURCE ---");
            console.log(expectedCode);
        }
        
        expect(isMatch).toBe(true);
    }, 30000);
});
