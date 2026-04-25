import { command, string, number, option } from 'cmd-ts';
import * as ts from 'typescript';
import * as fs from 'node:fs';
import { detectComponents } from '../extract/detectComponents';

export const detectCmd = command({
    name: 'detect',
    description: 'Detect extractable components in a file',
    args: {
        file: option({ type: string, long: 'file' }),
        start: option({ type: number, long: 'start' }),
        end: option({ type: number, long: 'end' }),
    },
    handler: ({ file, start, end }) => {
        const sourceCode = fs.readFileSync(file, 'utf-8');
        const sourceFile = ts.createSourceFile(file, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        
        const candidates = detectComponents(sourceFile, { start, end });
        
        // Map to a serializable format
        const result = candidates.map(c => ({
            description: c.description,
            start: c.node.getStart(sourceFile),
            end: c.node.getEnd()
        }));
        
        console.log(JSON.stringify(result, null, 2));
    }
});
