import { command, string, number, option } from 'cmd-ts';
import * as ts from 'typescript';
import { detectComponents } from '../extract/detectComponents';
import { detectPropsList } from '../extract/detectPropsList';

export const propsCmd = command({
    name: 'props',
    description: 'Detect props for a component selection',
    args: {
        file: option({ type: string, long: 'file' }),
        start: option({ type: number, long: 'start' }),
        end: option({ type: number, long: 'end' }),
    },
    handler: ({ file, start, end }) => {
        const program = ts.createProgram([file], { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.Latest });
        const sourceFile = program.getSourceFile(file)!;
        const typeChecker = program.getTypeChecker();

        const candidates = detectComponents(sourceFile, { start, end });
        if (!candidates.length) {
            console.error(JSON.stringify({ error: "No candidates found at the given selection" }));
            process.exit(1);
        }
        
        // Use the first matched candidate
        const request = detectPropsList(sourceFile, typeChecker, candidates[0]);
        
        const result = {
            props: request.props.map(p => ({ name: p.name })),
            hasChildren: request.hasChildren
        };
        
        console.log(JSON.stringify(result, null, 2));
    }
});
