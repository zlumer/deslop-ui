import { command, string, number, option, multioption, boolean, flag, optional } from 'cmd-ts';
import * as ts from 'typescript';
import * as fs from 'node:fs';
import { detectPropsList } from '../extract/detectPropsList';
import { performRefactoring } from '../extract/performRefactoring';
import { applyTextChanges } from '../extract/applyTextChanges';
import { resolveCandidate } from '../extract/utils';

export const extractCmd = command({
    name: 'extract',
    description: 'Extract a component and apply text changes',
    args: {
        file: option({ type: string, long: 'file' }),
        start: option({ type: optional(string), long: 'start', description: 'Offset or line:col (1-based)' }),
        end: option({ type: optional(string), long: 'end', description: 'Offset or line:col (1-based)' }),
        tag: option({ type: optional(string), long: 'tag' }),
        name: option({ type: string, long: 'name' }),
        prop: multioption({ type: string, long: 'prop', short: 'p', description: 'Prop renames in format oldName:newName' }),
        extractChildren: flag({ type: boolean, long: 'extract-children', defaultValue: () => false })
    },
    handler: ({ file, start, end, tag, name, prop, extractChildren }) => {
        const sourceCode = fs.readFileSync(file, 'utf-8');
        const program = ts.createProgram([file], { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.Latest });
        const sourceFile = program.getSourceFile(file)!;
        const typeChecker = program.getTypeChecker();

        let candidate;
        try {
            candidate = resolveCandidate(sourceFile, start, end, tag);
        } catch (err: any) {
            console.error(err.message);
            process.exit(1);
        }

        const request = detectPropsList(sourceFile, typeChecker, candidate);
        
        const propRenames: Record<string, string> = {};
        if (prop && prop.length > 0) {
            prop.forEach(p => {
                const [oldName, newName] = p.split(':').map(s => s.trim());
                if (oldName && newName) propRenames[oldName] = newName;
            });
        }
        
        const decisions = {
            componentName: name,
            propRenames,
            childrenReplacementNodes: extractChildren ? request.childrenNodes : []
        };

        const result = performRefactoring(sourceFile, request, decisions);
        const newCode = applyTextChanges(sourceCode, result.textChanges);
        
        fs.writeFileSync(file, newCode, 'utf-8');
        console.log(JSON.stringify({ success: true, file, componentName: name }));
    }
});
