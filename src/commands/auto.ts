import { command, string, option, positional } from 'cmd-ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { detectComponents } from '../extract/detectComponents';
import { detectPropsList } from '../extract/detectPropsList';

export const autoCmd = command({
    name: 'auto',
    description: 'Automatically refactor components using AI',
    args: {
        path: positional({ 
            type: string, 
            displayName: 'path',
            description: 'Path to a file or directory to refactor'
        }),
        aiCommand: option({ 
            type: string, 
            long: 'ai-command',
            description: 'The CLI command to run the AI model (e.g. "claude" or "llm -m gpt-4o")'
        }),
    },
    handler: ({ path: inputPath, aiCommand }) => {
        let inputFile: string | undefined;

        if (!fs.existsSync(inputPath)) {
            throw new Error(`Path does not exist: ${inputPath}`);
        }

        const stat = fs.statSync(inputPath);

        if (stat.isFile()) {
            if (inputPath.endsWith('.tsx')) {
                inputFile = inputPath;
            }
        } else if (stat.isDirectory()) {
            const files = fs.readdirSync(inputPath);
            const tsxFile = files.find(f => f.endsWith('.tsx'));
            if (tsxFile) {
                inputFile = path.join(inputPath, tsxFile);
            }
        }

        if (!inputFile) {
            throw new Error(`No .tsx file found at path: ${inputPath}`);
        }

        const sourceCode = fs.readFileSync(inputFile, 'utf-8');
        
        // Create a TS program to get the TypeChecker (required for detectPropsList)
        const program = ts.createProgram([inputFile], {
            target: ts.ScriptTarget.Latest,
            jsx: ts.JsxEmit.React,
            moduleResolution: ts.ModuleResolutionKind.NodeJs
        });
        const typeChecker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(inputFile);

        if (!sourceFile) {
            throw new Error(`Could not parse source file: ${inputFile}`);
        }

        // Detect all components in the entire file
        const candidates = detectComponents(sourceFile, { start: 0, end: sourceCode.length });

        const analysisData = {
            originalCode: sourceCode,
            candidates: candidates.map(candidate => {
                const propsData = detectPropsList(sourceFile, typeChecker, candidate);
                return {
                    description: candidate.description,
                    start: candidate.start,
                    end: candidate.end,
                    complexity: candidate.complexity,
                    props: propsData.props.map(p => p.name)
                };
            })
        };

        console.log('Analysis Data:', JSON.stringify(analysisData, null, 2));
    }
});
