import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { ToolDefinition } from '../types/index.js';

const execAsync = promisify(exec);

export class ShellTool {
    static get definition(): any {
        return {
            name: 'execute_command',
            description: 'Execute a shell command on the local system and return the output.',
            schema: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The shell command to execute.'
                    }
                },
                required: ['command']
            },
            execute: this.execute
        };
    }

    static async execute(args: { command: string }): Promise<any> {
        try {
            const { stdout, stderr } = await execAsync(args.command);
            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                success: true
            };
        } catch (error: any) {
            return {
                stdout: error.stdout?.trim() || '',
                stderr: error.stderr?.trim() || error.message,
                success: false
            };
        }
    }
}

export class SystemInfoTool {
    static get definition(): any {
        return {
            name: 'get_system_info',
            description: 'Get information about the current system environment.',
            schema: { type: 'object', properties: {} },
            execute: this.execute
        };
    }

    static async execute(): Promise<any> {
        return {
            os: process.platform,
            arch: process.arch,
            cwd: process.cwd(),
            nodeVersion: process.version,
        };
    }
}
