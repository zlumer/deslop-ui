import { expect, it } from 'vitest';
import * as ts from 'typescript';
import { equals } from "../../src/fuzzy"
import { RefactorResult } from '../../src/extract/types';
import { applyTextChanges } from '../../src/extract/applyTextChanges';

export function prepareTS(inputCode: string)
{
	const fileName = 'App.tsx';
	const compilerOptions: ts.CompilerOptions = {
		target: ts.ScriptTarget.Latest,
		jsx: ts.JsxEmit.React,
		module: ts.ModuleKind.CommonJS
	};

	const host = ts.createCompilerHost(compilerOptions);
	const originalGetSourceFile = host.getSourceFile;

	// Intercept filesystem calls to serve our in-memory code
	host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
	{
		if (name === fileName)
		{
			return ts.createSourceFile(fileName, inputCode, languageVersion, true, ts.ScriptKind.TSX);
		}
		return originalGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
	};

	const program = ts.createProgram([fileName], compilerOptions, host);
	const typeChecker = program.getTypeChecker();
	const sourceFile = program.getSourceFile(fileName);

	if (!sourceFile)
	{
		throw new Error("Failed to generate SourceFile");
	}
	return { sourceFile, typeChecker };
}

export function sft(title: string, INPUT_CODE: string, EXPECTED_CODE: string, testFn: (args: {
	inputCode: string,
	sourceFile: ts.SourceFile,
	typeChecker: ts.TypeChecker
}) => RefactorResult)
{
	return it(title, () =>
	{
		// -------------------------------------------------------------------
		// SETUP: Define inputs, outputs, and create a TS Program
		// -------------------------------------------------------------------

		// Set up an in-memory TypeScript program to get AST and TypeChecker
		const { sourceFile, typeChecker } = prepareTS(INPUT_CODE);

		const result = testFn({ inputCode: INPUT_CODE, sourceFile, typeChecker });

		// Apply TextChanges to the original string to verify the final output
		const finalSourceCode = applyTextChanges(INPUT_CODE, result.textChanges);
		if (!equals(finalSourceCode, EXPECTED_CODE))
			expect(finalSourceCode).toBe(EXPECTED_CODE)
	})
}
