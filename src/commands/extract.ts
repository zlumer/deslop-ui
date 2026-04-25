import { command, string, number, option, boolean, flag } from 'cmd-ts';
import * as ts from 'typescript';
import * as fs from 'node:fs';
import { detectComponents } from '../extract/detectComponents';
import { detectPropsList } from '../extract/detectPropsList';
import { performRefactoring } from '../extract/performRefactoring';
import { applyTextChanges } from '../extract/applyTextChanges';

export const extractCmd = command({
    name: 'extract',
    description: 'Extract a component and apply text changes',
    args: {
        file: option({ type: string, long: 'file' }),
        start: option({ type: number, long: 'start' }),
        end: option({ type: number, long: 'end' }),
        name: option({ type: string, long: 'name' }),
        props: option({ type: string, long: 'props', description: 'Comma-separated props', defaultValue: () => '' }),
        extractChildren: flag({ type: boolean, long: 'extract-children', defaultValue: () => false })
    },
    handler: ({ file, start, end, name, props, extractChildren }) => {
        const sourceCode = fs.readFileSync(file, 'utf-8');
        const program = ts.createProgram([file], { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.Latest });
        const sourceFile = program.getSourceFile(file)!;
        const typeChecker = program.getTypeChecker();

        const candidates = detectComponents(sourceFile, { start, end });
        if (!candidates.length) {
            console.error(JSON.stringify({ error: "No candidates found at the given selection" }));
            process.exit(1);
        }
        
        const request = detectPropsList(sourceFile, typeChecker, candidates[0]);
        const selectedProps = props ? props.split(',').map(p => p.trim()).filter(Boolean) : [];
        
        const decisions = {
            componentName: name,
            selectedProps,
            childrenReplacementNodes: extractChildren ? request.childrenNodes : []
        };

        const result = performRefactoring(sourceFile, request, decisions);
        const newCode = applyTextChanges(sourceCode, result.textChanges);
        
        fs.writeFileSync(file, newCode, 'utf-8');
        console.log(JSON.stringify({ success: true, file, componentName: name }));
    }
});
