import { command, string, option, positional } from 'cmd-ts';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
    handler: ({ path: inputPath, aiCommand }) => {
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

        console.log('Input File:', inputFile);
        console.log('AI Command:', aiCommand);
    }
});
