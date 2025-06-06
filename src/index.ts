import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class AzureMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'azure-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'az_execute',
          description: 'Execute any Azure CLI command',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Az CLI command without "az" prefix',
              },
              args: {
                type: 'array',
                items: { type: 'string' },
                description: 'Additional arguments',
              },
              format: {
                type: 'string',
                enum: ['json', 'table', 'tsv', 'yaml', 'none'],
                default: 'json',
              },
              subscription: {
                type: 'string',
                description: 'Subscription ID to use',
              },
            },
            required: ['command'],
          },
        },
        {
          name: 'az_login',
          description: 'Login to Azure',
          inputSchema: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['interactive', 'service-principal', 'managed-identity', 'cli'],
                default: 'cli',
              },
              tenant: {
                type: 'string',
              },
              username: {
                type: 'string',
              },
              password: {
                type: 'string',
              },
              clientId: {
                type: 'string',
              },
            },
          },
        },
        {
          name: 'az_account_set',
          description: 'Set the active Azure subscription',
          inputSchema: {
            type: 'object',
            properties: {
              subscription: {
                type: 'string',
                description: 'Subscription name or ID',
              },
            },
            required: ['subscription'],
          },
        },
        {
          name: 'az_account_list',
          description: 'List all Azure subscriptions',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'az_resource_list',
          description: 'List Azure resources',
          inputSchema: {
            type: 'object',
            properties: {
              resourceGroup: {
                type: 'string',
              },
              resourceType: {
                type: 'string',
              },
              tags: {
                type: 'object',
              },
            },
          },
        },
        {
          name: 'az_aks_get_credentials',
          description: 'Get AKS cluster credentials',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'AKS cluster name',
              },
              resourceGroup: {
                type: 'string',
                description: 'Resource group name',
              },
              admin: {
                type: 'boolean',
                default: false,
              },
              overwriteExisting: {
                type: 'boolean',
                default: true,
              },
            },
            required: ['name', 'resourceGroup'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'az_execute':
            return await this.handleExecute(args);
          case 'az_login':
            return await this.handleLogin(args);
          case 'az_account_set':
            return await this.handleAccountSet(args);
          case 'az_account_list':
            return await this.handleAccountList();
          case 'az_resource_list':
            return await this.handleResourceList(args);
          case 'az_aks_get_credentials':
            return await this.handleAksGetCredentials(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Azure CLI error: ${error.message}`
        );
      }
    });
  }

  private async handleExecute(args: any) {
    let command = `az ${args.command}`;
    
    if (args.args && args.args.length > 0) {
      command += ' ' + args.args.join(' ');
    }
    
    if (args.format) {
      command += ` --output ${args.format}`;
    }
    
    if (args.subscription) {
      command += ` --subscription "${args.subscription}"`;
    }

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [
        {
          type: 'text',
          text: stdout,
        },
      ],
    };
  }

  private async handleLogin(args: any) {
    let command = 'az login';
    
    switch (args.method) {
      case 'service-principal':
        if (!args.username || !args.password || !args.tenant) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Service principal login requires username, password, and tenant'
          );
        }
        command += ` --service-principal -u "${args.username}" -p "${args.password}" --tenant "${args.tenant}"`;
        break;
      case 'managed-identity':
        command += ' --identity';
        if (args.clientId) {
          command += ` --username "${args.clientId}"`;
        }
        break;
      case 'interactive':
        command += ' --use-device-code';
        break;
      case 'cli':
      default:
        // Basic login
        break;
    }

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [
        {
          type: 'text',
          text: stdout || 'Login successful',
        },
      ],
    };
  }

  private async handleAccountSet(args: any) {
    const command = `az account set --subscription "${args.subscription}"`;
    const { stdout, stderr } = await execAsync(command);
    
    return {
      content: [
        {
          type: 'text',
          text: stdout || `Subscription set to: ${args.subscription}`,
        },
      ],
    };
  }

  private async handleAccountList() {
    const command = 'az account list --output json';
    const { stdout, stderr } = await execAsync(command);
    
    return {
      content: [
        {
          type: 'text',
          text: stdout,
        },
      ],
    };
  }

  private async handleResourceList(args: any) {
    let command = 'az resource list';
    
    if (args.resourceGroup) {
      command += ` --resource-group "${args.resourceGroup}"`;
    }
    
    if (args.resourceType) {
      command += ` --resource-type "${args.resourceType}"`;
    }
    
    if (args.tags) {
      const tagString = Object.entries(args.tags)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      command += ` --tag ${tagString}`;
    }
    
    command += ' --output json';

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [
        {
          type: 'text',
          text: stdout,
        },
      ],
    };
  }

  private async handleAksGetCredentials(args: any) {
    let command = `az aks get-credentials --name "${args.name}" --resource-group "${args.resourceGroup}"`;
    
    if (args.admin) {
      command += ' --admin';
    }
    
    if (args.overwriteExisting) {
      command += ' --overwrite-existing';
    }

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [
        {
          type: 'text',
          text: stdout || 'AKS credentials retrieved successfully',
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Azure MCP server running on stdio');
  }
}

const server = new AzureMCPServer();
server.run().catch(console.error);
