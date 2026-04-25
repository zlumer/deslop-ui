#!/usr/bin/env npx -y tsx

import { subcommands, run } from 'cmd-ts';
import { detectCmd } from './commands/detect';
import { propsCmd } from './commands/props';
import { extractCmd } from './commands/extract';

const app = subcommands({
    name: 'refactor',
    description: 'React component extraction CLI',
    cmds: {
        detect: detectCmd,
        props: propsCmd,
        extract: extractCmd,
    },
});

if (require.main === module) {
    run(app, process.argv.slice(2));
}
