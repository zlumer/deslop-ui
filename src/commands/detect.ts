import { command, string, option } from 'cmd-ts';
import * as ts from 'typescript';
import * as fs from 'node:fs';
import { detectComponents } from '../extract/detectComponents';

function parsePosition(pos: string, sourceFile: ts.SourceFile): number {
    if (pos.includes(':')) {
        const [line, col] = pos.split(':').map(Number);
        return sourceFile.getPositionOfLineAndCharacter(line - 1, col - 1);
    }
    return parseInt(pos, 10);
}

export const detectCmd = command({
    name: 'detect',
    description: 'Detect extractable components in a file',
    args: {
        file: option({ type: string, long: 'file' }),
        start: option({ type: string, long: 'start' }),
        end: option({ type: string, long: 'end' }),
    },
    handler: ({ file, start, end }) => {
        const sourceCode = fs.readFileSync(file, 'utf-8');
        const sourceFile = ts.createSourceFile(file, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        
        const startPos = parsePosition(start, sourceFile);
        const endPos = parsePosition(end, sourceFile);

        const candidates = detectComponents(sourceFile, { start: startPos, end: endPos });
        
        // Map to a serializable format
        const result = candidates.map(c => ({
            description: c.description,
            start: c.node.getStart(sourceFile),
            end: c.node.getEnd()
        }));
        
        console.log(JSON.stringify(result, null, 2));
    }
});
