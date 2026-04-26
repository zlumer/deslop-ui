import * as ts from 'typescript';
import { EditorSelection, ExtractionCandidates } from './types';
import { generateTag } from './utils';

/**
 * 1. Detects which JSX components within the given selection are valid for extraction.
 *
 * @param sourceFile - The parsed AST of the current file.
 * @param selection - The cursor position or highlight range.
 */

export function detectComponents(
	sourceFile: ts.SourceFile,
	selection: EditorSelection
): ExtractionCandidates
{
	const candidates: ExtractionCandidates = [];

	function visit(node: ts.Node)
	{
		const start = node.getStart(sourceFile);
		const end = node.getEnd();

		// Check if the node intersects with the selection
		if (start <= selection.end && end >= selection.start)
		{
			// Visit children first (post-order traversal) so innermost nodes are first
			ts.forEachChild(node, visit);

			if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))
			{
				let description = node.getText(sourceFile).split('\n')[0];
				candidates.push({
					tag: generateTag(description, start.toString(), end.toString()),
					node,
					description,
					start: {
						index: start,
						...sourceFile.getLineAndCharacterOfPosition(start)
					},
					end: {
						index: end,
						...sourceFile.getLineAndCharacterOfPosition(end)
					}
				});
			}
		}
	}

	visit(sourceFile);
	return candidates;
}
