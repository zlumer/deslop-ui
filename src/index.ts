#!/usr/bin/env -S npx -y tsx

import { subcommands, run } from 'cmd-ts';
import { detectCmd } from './commands/detect';
import { propsCmd } from './commands/props';
import { extractCmd } from './commands/extract';
import { autoCmd } from './commands/auto';

const app = subcommands({
    name: 'deslop-ui',
    description: 'React component extraction CLI',
    cmds: {
        detect: detectCmd,
        props: propsCmd,
        extract: extractCmd,
        auto: autoCmd,
    },
});

if (require.main === module) {
    run(app, process.argv.slice(2));
}
