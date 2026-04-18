import * as ts from 'typescript';

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
