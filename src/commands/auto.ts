import { command, string, option, positional } from 'cmd-ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { execSync } from 'node:child_process';
import { detectComponents } from '../extract/detectComponents';
import { detectPropsList } from '../extract/detectPropsList';
import { performRefactoring } from '../extract/performRefactoring';
import { applyTextChanges } from '../extract/applyTextChanges';
import { AiExtractionMap } from '../refactor';

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

            // --- Sequential extraction ---
            // Each extraction modifies the source, invalidating positions for
            // subsequent candidates. We re-parse between each extraction and
            // match candidates by their original JSX text content.

            // Build a lookup: nodeId -> { extraction config, original node text }
            const extractionPlan: Array<{
                name: string;
                folder: string;
                originalNodeText: string;
                isLayoutSlot?: boolean;
            }> = [];

            for (const ext of aiDecision.extractions) {
                const candidate = candidates.find(c => c.tag === ext.nodeId);
                if (!candidate) {
                    console.warn(`Warning: No candidate found for nodeId "${ext.nodeId}" (name: ${ext.name}), skipping.`);
                    continue;
                }
                extractionPlan.push({
                    name: ext.name,
                    folder: ext.folder,
                    originalNodeText: candidate.node.getText(sourceFile),
                    isLayoutSlot: ext.isLayoutSlot,
                });
            }

            // Create a backup before modifying the file
            const backupFile = inputFile + '.bak';
            fs.copyFileSync(inputFile, backupFile);

            console.log(`Running refactoring engine (${extractionPlan.length} extractions)...`);
            let extractedCount = 0;
            const warnings: string[] = [];

            for (const extraction of extractionPlan) {
                // Re-read and re-parse the (possibly modified) source
                const currentSource = fs.readFileSync(inputFile, 'utf-8');
                const currentProgram = ts.createProgram([inputFile], {
                    target: ts.ScriptTarget.Latest,
                    jsx: ts.JsxEmit.React,
                    moduleResolution: ts.ModuleResolutionKind.NodeJs,
                });
                const currentTypeChecker = currentProgram.getTypeChecker();
                const currentSourceFile = currentProgram.getSourceFile(inputFile);

                if (!currentSourceFile) {
                    warnings.push(`Failed to re-parse source after previous extraction, stopping.`);
                    break;
                }

                // Re-detect candidates and match by original node text
                const currentCandidates = detectComponents(currentSourceFile, {
                    start: 0,
                    end: currentSource.length,
                });

                const matchingCandidate = currentCandidates.find(
                    c => c.node.getText(currentSourceFile) === extraction.originalNodeText
                );

                if (!matchingCandidate) {
                    warnings.push(`Could not locate candidate for "${extraction.name}" after previous extractions, skipping.`);
                    continue;
                }

                // Detect props for this candidate
                const request = detectPropsList(currentSourceFile, currentTypeChecker, matchingCandidate);

                // Build refactor decisions
                const decisions = {
                    componentName: extraction.name,
                    propRenames: {} as Record<string, string>,
                    childrenReplacementNodes: extraction.isLayoutSlot ? request.childrenNodes : [],
                };

                // Perform the AST refactoring and apply text changes
                const refactorResult = performRefactoring(currentSourceFile, request, decisions);
                const newCode = applyTextChanges(currentSource, refactorResult.textChanges);

                fs.writeFileSync(inputFile, newCode, 'utf-8');
                extractedCount++;
                console.log(`  Extracted: ${extraction.name} (${extraction.folder})`);
            }

            const success = extractedCount > 0;

            console.log('\n--- Refactor Summary ---');
            console.log(`Success: ${success}`);
            console.log(`Extractions Completed: ${extractedCount}/${aiDecision.extractions.length}`);
            if (warnings.length > 0) console.log(`Warnings:\n  - ${warnings.join('\n  - ')}`);
            console.log(`Backup: ${backupFile}`);

            if (success) {
                console.log('\nAuto-refactor complete. Please review the changes.');
            } else {
                console.log('\nAuto-refactor finished with no successful extractions. Check warnings.');
            }

        } catch (error: any) {
            console.error("Error running AI command:", error.message);
            if (error.stdout) console.error("Stdout:", error.stdout);
            if (error.stderr) console.error("Stderr:", error.stderr);
        }
    }
});
