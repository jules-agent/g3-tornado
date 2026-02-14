// WebMCP library (simplified version for proof-of-concept)
// Full library: https://github.com/webmachinelearning/webmcp

class WebMCP {
  constructor(options = {}) {
    this.tools = new Map();
    this.prompts = new Map();
    this.resources = new Map();
    this.options = {
      color: options.color || '#0066cc',
      position: options.position || 'bottom-right',
      size: options.size || '40px',
      padding: options.padding || '15px'
    };
    
    // Expose API to browser/agent
    if (typeof navigator !== 'undefined') {
      navigator.modelContext = this;
    }
    
    // Create indicator widget
    this._createWidget();
  }
  
  _createWidget() {
    const widget = document.createElement('div');
    widget.id = 'webmcp-indicator';
    widget.style.cssText = `
      position: fixed;
      ${this.options.position.includes('bottom') ? 'bottom' : 'top'}: ${this.options.padding};
      ${this.options.position.includes('right') ? 'right' : 'left'}: ${this.options.padding};
      width: ${this.options.size};
      height: ${this.options.size};
      background: ${this.options.color};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    widget.innerHTML = '🤖';
    widget.title = `WebMCP enabled (${this.tools.size} tools registered)`;
    
    widget.addEventListener('click', () => {
      alert(`WebMCP Tools:\n${Array.from(this.tools.keys()).join('\n')}`);
    });
    
    if (document.body) {
      document.body.appendChild(widget);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(widget);
      });
    }
  }
  
  registerTool(name, description, schema, handler) {
    this.tools.set(name, {
      name,
      description,
      inputSchema: {
        type: 'object',
        properties: schema,
        required: Object.keys(schema).filter(k => schema[k].required !== false)
      },
      handler
    });
    
    // Update widget tooltip
    const widget = document.getElementById('webmcp-indicator');
    if (widget) {
      widget.title = `WebMCP enabled (${this.tools.size} tools registered)`;
    }
    
    console.log(`[WebMCP] Registered tool: ${name}`);
  }
  
  registerPrompt(name, description, args, handler) {
    this.prompts.set(name, {
      name,
      description,
      arguments: args || [],
      handler
    });
    console.log(`[WebMCP] Registered prompt: ${name}`);
  }
  
  registerResource(name, description, metadata, handler) {
    this.resources.set(name, {
      name,
      description,
      ...metadata,
      handler
    });
    console.log(`[WebMCP] Registered resource: ${name}`);
  }
  
  // API for agents to call tools
  async callTool(name, args) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    console.log(`[WebMCP] Calling tool: ${name}`, args);
    
    try {
      const result = await tool.handler(args);
      return {
        content: Array.isArray(result) ? result : [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }]
      };
    }
  }
  
  // List available tools (for discovery)
  listTools() {
    return Array.from(this.tools.values()).map(({ handler, ...tool }) => tool);
  }
  
  listPrompts() {
    return Array.from(this.prompts.values()).map(({ handler, ...prompt }) => prompt);
  }
  
  listResources() {
    return Array.from(this.resources.values()).map(({ handler, ...resource }) => resource);
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.WebMCP = WebMCP;
}
