import { command, string, option, optional } from 'cmd-ts';
import * as ts from 'typescript';
import { detectComponents } from '../extract/detectComponents';
import { detectPropsList } from '../extract/detectPropsList';

function parsePosition(pos: string, sourceFile: ts.SourceFile): number {
    if (pos.includes(':')) {
        const [line, col] = pos.split(':').map(Number);
        return sourceFile.getPositionOfLineAndCharacter(line - 1, col - 1);
    }
    return parseInt(pos, 10);
}

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

        let startPos = 0;
        let endPos = sourceFile.getEnd();

        if (start && end) {
            startPos = parsePosition(start, sourceFile);
            endPos = parsePosition(end, sourceFile);
        } else if (!tag) {
            console.error(JSON.stringify({ error: "Must provide either --tag or both --start and --end" }));
            process.exit(1);
        }

        const candidates = detectComponents(sourceFile, { start: startPos, end: endPos });
        
        let candidate;
        if (tag) {
            candidate = candidates.find(c => c.tag === tag);
            if (!candidate) {
                console.error(JSON.stringify({ error: `No candidate found with tag ${tag}` }));
                process.exit(1);
            }
        } else {
            if (!candidates.length) {
                console.error(JSON.stringify({ error: "No candidates found at the given selection" }));
                process.exit(1);
            }
            candidate = candidates[0];
        }
        
        const request = detectPropsList(sourceFile, typeChecker, candidate);
        
        const result = {
            props: request.props.map(p => ({ name: p.name })),
            hasChildren: request.hasChildren
        };
        
        console.log(JSON.stringify(result, null, 2));
    }
});
