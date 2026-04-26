import * as crypto from 'node:crypto';
import base58 from 'base58';
import * as ts from 'typescript';

export function generateTag(description: string, start: string, end: string): string {
    const hash = crypto.createHash('sha256').update(`${description}|${start}|${end}`).digest();
    // Use the first 6 bytes as an integer to ensure the resulting base58 string is short
    const num = hash.readUInt32BE(0);
    return base58.encode(num);
}

export function positionToLineCol({ line, character }: { line: number; character: number }): `${number}:${number}` {
	return `${line + 1}:${character + 1}`; // Convert to 1-based
}

export function parsePosition(pos: string, sourceFile: ts.SourceFile): number {
    if (pos.includes(':')) {
        const [line, col] = pos.split(':').map(Number);
        return sourceFile.getPositionOfLineAndCharacter(line - 1, col - 1);
    }
    return parseInt(pos, 10);
}

export function resolveCandidate(
    sourceFile: ts.SourceFile,
    start?: string,
    end?: string,
    tag?: string
): import('./types').ExtractionCandidate {
    let startPos = 0;
    let endPos = sourceFile.getEnd();

    if (start && end) {
        startPos = parsePosition(start, sourceFile);
        endPos = parsePosition(end, sourceFile);
    } else if (!tag) {
        throw new Error(JSON.stringify({ error: "Must provide either --tag or both --start and --end" }));
    }

    // We need to import detectComponents here or at the top of the file
    const { detectComponents } = require('./detectComponents');
    const candidates = detectComponents(sourceFile, { start: startPos, end: endPos });
    
    if (tag) {
        const candidate = candidates.find((c: any) => c.tag === tag);
        if (!candidate) {
            throw new Error(JSON.stringify({ error: `No candidate found with tag ${tag}` }));
        }
        return candidate;
    }

    if (!candidates.length) {
        throw new Error(JSON.stringify({ error: "No candidates found at the given selection" }));
    }
    return candidates[0];
}
