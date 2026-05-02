import { command, string, option, positional } from 'cmd-ts';

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
    handler: ({ path, aiCommand }) => {
        console.log('Path:', path);
        console.log('AI Command:', aiCommand);
    }
});
