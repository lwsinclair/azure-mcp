# Azure MCP

A Model Context Protocol server for Azure CLI operations. This MCP allows Claude to manage Azure resources, subscriptions, and services.

## Features

- **Subscription Management**
  - List subscriptions
  - Set active subscription
  - Login with various methods

- **Resource Management**
  - List resources
  - Filter by resource group
  - Filter by resource type
  - Filter by tags

- **AKS Operations**
  - Get cluster credentials
  - Manage Kubernetes clusters

- **Generic Azure CLI**
  - Execute any Azure CLI command
  - Support for JSON, table, TSV, YAML output
  - Full argument support

## Installation

```bash
# Clone the repository
git clone https://github.com/eddyv73/azure-mcp.git
cd azure-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Prerequisites

Make sure you have Azure CLI installed:
```bash
# Check Azure CLI version
az --version

# Install Azure CLI (macOS)
brew update && brew install azure-cli
```

## Configuration

Add to Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "azure": {
      "command": "node",
      "args": ["/path/to/azure-mcp/dist/index.js"]
    }
  }
}
```

Replace `/path/to/azure-mcp` with the actual path where you cloned this repository.

## Usage in Claude

Once configured, you can use commands like:

- "List all my Azure subscriptions"
- "Set the active subscription to Production"
- "List all VMs in resource group myRG"
- "Get credentials for my AKS cluster"
- "Create a new resource group in East US"

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start the server
npm start
```

## License

MIT
