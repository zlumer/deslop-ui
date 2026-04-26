import { command, string, option, optional } from 'cmd-ts';
import * as ts from 'typescript';
import { detectPropsList } from '../extract/detectPropsList';
import { resolveCandidate } from '../extract/utils';

export const propsCmd = command({
    name: 'props',
    description: 'Detect props for a component selection',
    args: {
        file: option({ type: string, long: 'file' }),
        start: option({ type: optional(string), long: 'start' }),
        end: option({ type: optional(string), long: 'end' }),
        tag: option({ type: optional(string), long: 'tag' }),
    },
    handler: ({ file, start, end, tag }) => {
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
        
        const result = {
            props: request.props.map(p => ({ name: p.name })),
            hasChildren: request.hasChildren
        };
        
        console.log(JSON.stringify(result, null, 2));
    }
});
