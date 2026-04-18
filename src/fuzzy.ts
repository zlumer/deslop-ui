/**
 * Uses TypeScript AST to compare two code snippets for "fuzzy" equality, ignoring formatting and minor differences.
 * This is used in tests to verify that the refactored code is semantically the same as the expected code, even if whitespace or formatting differs.
 * This also equals `type` and `interface` declarations that have the same properties.
 * @param a 
 * @param b 
 */
export function equals(a: string, b: string): boolean
{
	throw new Error('Not implemented')
}
