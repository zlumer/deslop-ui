import * as ts from 'typescript';

/**
 * Utility function to apply TS compiler TextChanges to a source string.
 * Changes must be applied from the bottom of the file to the top (reverse offset order)
 * so that earlier offset replacements do not invalidate later offset positions.
 */

export function applyTextChanges(source: string, changes: ts.TextChange[]): string
{
	const sortedChanges = [...changes].sort((a, b) => b.span.start - a.span.start);
	let result = source;

	for (const change of sortedChanges)
	{
		const head = result.slice(0, change.span.start);
		const tail = result.slice(change.span.start + change.span.length);
		result = head + change.newText + tail;
	}

	return result;
}
