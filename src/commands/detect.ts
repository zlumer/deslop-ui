import { command, string, option } from 'cmd-ts';
import * as ts from 'typescript';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import base58 from 'base58';
import { detectComponents } from '../extract/detectComponents';

function parsePosition(pos: string, sourceFile: ts.SourceFile): number {
    if (pos.includes(':')) {
        const [line, col] = pos.split(':').map(Number);
        return sourceFile.getPositionOfLineAndCharacter(line - 1, col - 1);
    }
    return parseInt(pos, 10);
}
function positionToLineCol(pos: number, sourceFile: ts.SourceFile): `${number}:${number}` {
	const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
	return `${line + 1}:${character + 1}`; // Convert to 1-based
}

function generateTag(description: string, start: string, end: string): string {
    const hash = crypto.createHash('sha256').update(`${description}|${start}|${end}`).digest();
    // Use the first 4 bytes as an integer to ensure the resulting base58 string is short
    const num = hash.readUInt32BE(0);
    return base58.encode(num);
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
        const result = candidates.map(c => {
            const startStr = positionToLineCol(c.node.getStart(sourceFile), sourceFile);
            const endStr = positionToLineCol(c.node.getEnd(), sourceFile);
            return {
                tag: generateTag(c.description, startStr, endStr),
                description: c.description,
                start: startStr,
                end: endStr,
            };
        });
        
        console.log(JSON.stringify(result, null, 2));
    }
});
