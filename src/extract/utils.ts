import * as crypto from 'node:crypto';
import base58 from 'base58';

export function generateTag(description: string, start: string, end: string): string {
    const hash = crypto.createHash('sha256').update(`${description}|${start}|${end}`).digest();
    // Use the first 6 bytes as an integer to ensure the resulting base58 string is short
    const num = hash.readUInt32BE(0);
    return base58.encode(num);
}

export function positionToLineCol({ line, character }: { line: number; character: number }): `${number}:${number}` {
	return `${line + 1}:${character + 1}`; // Convert to 1-based
}
