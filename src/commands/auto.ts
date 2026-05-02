import { command, string, option, positional } from 'cmd-ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { execSync } from 'node:child_process';
import { detectComponents } from '../extract/detectComponents';
import { detectPropsList } from '../extract/detectPropsList';
import { runCliRefactor, AiExtractionMap } from '../refactor';

export const autoCmd = command({
    name: 'auto',
    description: 'Automatically refactor components using AI',
    args: {
        path: positional({ 
            type: string, 
            displayName: 'path',
            description: 'Path to a file or directory to refactor'
        }),
        aiCommand: option({ 
            type: string, 
            long: 'ai-command',
            description: 'The CLI command to run the AI model (e.g. "claude" or "llm -m gpt-4o")'
        }),
    },
    handler: async ({ path: inputPath, aiCommand }) => {
        let inputFile: string | undefined;

        if (!fs.existsSync(inputPath)) {
            throw new Error(`Path does not exist: ${inputPath}`);
        }

        const stat = fs.statSync(inputPath);

        if (stat.isFile()) {
            if (inputPath.endsWith('.tsx')) {
                inputFile = inputPath;
            }
        } else if (stat.isDirectory()) {
            const files = fs.readdirSync(inputPath);
            const tsxFile = files.find(f => f.endsWith('.tsx'));
            if (tsxFile) {
                inputFile = path.join(inputPath, tsxFile);
            }
        }

        if (!inputFile) {
            throw new Error(`No .tsx file found at path: ${inputPath}`);
        }

        const sourceCode = fs.readFileSync(inputFile, 'utf-8');
        
        // Create a TS program to get the TypeChecker (required for detectPropsList)
        const program = ts.createProgram([inputFile], {
            target: ts.ScriptTarget.Latest,
            jsx: ts.JsxEmit.React,
            moduleResolution: ts.ModuleResolutionKind.NodeJs
        });
        const typeChecker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(inputFile);

        if (!sourceFile) {
            throw new Error(`Could not parse source file: ${inputFile}`);
        }

        // Detect all components in the entire file
        const candidates = detectComponents(sourceFile, { start: 0, end: sourceCode.length });

        const analysisData = {
            originalCode: sourceCode,
            candidates: candidates.map(candidate => {
                const propsData = detectPropsList(sourceFile, typeChecker, candidate);
                return {
                    tag: candidate.tag,
                    description: candidate.description,
                    start: candidate.start,
                    end: candidate.end,
                    complexity: candidate.complexity,
                    props: propsData.props.map(p => p.name)
                };
            })
        };

        const generatedPrompt = `You are an expert React refactoring assistant.
Your task is to analyze the provided React component code and a list of detected extractable JSX nodes.
You must decide which of these nodes should be extracted into separate components to improve code quality, readability, and maintainability.

You are ONLY deciding WHAT to extract and where. Do NOT output any code. Output ONLY the JSON.

Return a valid JSON object matching this interface:
{
  "extractions": [
    {
      "nodeId": "string (use the 'tag' from the detected candidates)",
      "name": "string (suggested component name, e.g., 'UserCard', 'SubmitButton')",
      "folder": "atoms" | "molecules" | "organisms" | "layouts",
      "isLayoutSlot": boolean (optional, true if this should be passed as a children/slot prop)
    }
  ]
}

Here is the analysis data containing the original code and the detected candidates:
${JSON.stringify(analysisData, null, 2)}
`;

        console.log('Running AI command...');
        try {
            // Use JSON.stringify to safely quote the prompt for the shell
            const cmd = `${aiCommand} ${JSON.stringify(generatedPrompt)}`;
            const stdout = execSync(cmd, { encoding: 'utf-8' });
            console.log("AI DECISION:", stdout);

            let aiDecision: AiExtractionMap;
            try {
                // Extract JSON in case the AI wrapped it in markdown blocks
                const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                const jsonString = jsonMatch ? jsonMatch[0] : stdout;
                aiDecision = JSON.parse(jsonString);

                if (!aiDecision || !Array.isArray(aiDecision.extractions)) {
                    throw new Error("Missing 'extractions' array");
                }
                for (const ext of aiDecision.extractions) {
                    if (!ext.nodeId || !ext.name || !ext.folder) {
                        throw new Error("Extraction object missing required fields (nodeId, name, folder)");
                    }
                }
            } catch (e: any) {
                throw new Error(`AI did not return valid decision JSON: ${e.message}\nRaw output: ${stdout}`);
            }

            console.log(`Creating backup of original file at ${inputFile}.bak`);
            fs.writeFileSync(`${inputFile}.bak`, sourceCode);

            console.log('Running refactoring engine...');
            const result = await runCliRefactor(inputFile, { mockAiResponse: aiDecision });

            console.log('\n--- Refactor Summary ---');
            console.log(`Success: ${result.success}`);
            console.log(`Extractions Planned: ${aiDecision.extractions.length}`);
            if (result.warnings.length > 0) console.log(`Warnings:\n  - ${result.warnings.join('\n  - ')}`);
            console.log(`Temporary Refactor Dir: ${result.tmpRefactorDir}`);
            
            if (result.success) {
                console.log('\n✅ Auto-refactor complete! Please review the changes.');
            } else {
                console.log('\n⚠️ Auto-refactor finished, but reported no success. Check warnings.');
            }

        } catch (error: any) {
            console.error("Error running AI command:", error.message);
            if (error.stdout) console.error("Stdout:", error.stdout);
            if (error.stderr) console.error("Stderr:", error.stderr);
        }
    }
});
