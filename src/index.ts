#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';

export function getGreeting(name: string): string {
    return `Hello, ${name}!`;
}

// Simple CLI execution logic
if (require.main === module) {
    const args = process.argv.slice(2);
    const name = args[0] || 'World';
    
    console.log(getGreeting(name));

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
}
