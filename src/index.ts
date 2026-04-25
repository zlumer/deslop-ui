#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { command, run, positional, string, optional } from 'cmd-ts';

export function getGreeting(name: string): string {
    return `Hello, ${name}!`;
}

const app = command({
    name: 'greet',
    description: 'Print a greeting and list directory contents',
    version: '1.0.0',
    args: {
        name: positional({ type: optional(string), displayName: 'name' }),
    },
    handler: ({ name }) => {
        const finalName = name || 'World';
        
        console.log(getGreeting(finalName));

        // Example file system interaction
        const cwd = process.cwd();
        console.log(`\nCurrent directory contents (${cwd}):`);
        
        try {
            const files = fs.readdirSync(cwd);
            files.forEach((file: string) => {
                const isDir = fs.statSync(path.join(cwd, file)).isDirectory();
                console.log(`  ${isDir ? '📁' : '📄'} ${file}`);
            });
        } catch (error) {
            console.error('Error reading directory:', error);
        }
    },
});

// Simple CLI execution logic
if (require.main === module) {
    run(app, process.argv.slice(2));
}
