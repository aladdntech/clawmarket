const fs = require('fs');
const config = require('./config');

/**
 * Get a fresh Copilot API token (auto-refreshed by OpenClaw)
 */
function getCopilotToken() {
  try {
    const data = JSON.parse(fs.readFileSync(config.llm.copilot.tokenFile, 'utf8'));
    const now = Date.now();
    if (data.expiresAt && data.expiresAt < now) {
      console.warn('⚠️ Copilot token expired, OpenClaw should refresh it');
      return null;
    }
    return data.token;
  } catch (err) {
    // Token file not available (e.g. on Vultr) — fall through
    return null;
  }
}

/**
 * Get GitHub token for Models API (from GH_TOKEN env or gh CLI)
 */
function getGitHubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const { execSync } = require('child_process');
    return execSync('gh auth token 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Call LLM with automatic provider selection:
 * 1. Copilot API (if token available — local dev with OpenClaw)
 * 2. GitHub Models API (if GH_TOKEN available — Vultr/production)
 * 3. Throws error if neither available
 */
async function callLLM(messages, options = {}) {
  const {
    maxTokens = 2000,
    temperature = 0.1,
    jsonMode = false
  } = options;

  // Try Copilot first (best models)
  const copilotToken = getCopilotToken();
  if (copilotToken) {
    const model = options.model || config.llm.copilot.model;
    return _callCopilot(copilotToken, model, messages, { maxTokens, temperature, jsonMode });
  }

  // Fallback to GitHub Models API
  const ghToken = getGitHubToken();
  if (ghToken) {
    const model = options.model || config.llm.githubModels.model;
    return _callGitHubModels(ghToken, model, messages, { maxTokens, temperature, jsonMode });
  }

  throw new Error('No LLM provider available. Set GH_TOKEN or ensure Copilot token exists.');
}

async function _callCopilot(token, model, messages, opts) {
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    ...(opts.jsonMode && { response_format: { type: 'json_object' } })
  };

  const response = await fetch(config.llm.copilot.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...config.llm.copilot.headers
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    // Try fallback model on same provider
    if (model !== config.llm.copilot.fallbackModel) {
      console.warn(`Copilot ${model} failed, trying ${config.llm.copilot.fallbackModel}`);
      return _callCopilot(token, config.llm.copilot.fallbackModel, messages, opts);
    }
    // Try GitHub Models as last resort
    const ghToken = getGitHubToken();
    if (ghToken) {
      console.warn('Copilot failed, falling back to GitHub Models');
      return _callGitHubModels(ghToken, config.llm.githubModels.model, messages, opts);
    }
    throw new Error(`LLM API error (${response.status}): ${errText}`);
  }

  return _parseResponse(await response.json(), opts.jsonMode);
}

async function _callGitHubModels(token, model, messages, opts) {
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    ...(opts.jsonMode && { response_format: { type: 'json_object' } })
  };

  const response = await fetch(`${config.llm.githubModels.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub Models API error (${response.status}): ${errText}`);
  }

  return _parseResponse(await response.json(), opts.jsonMode);
}

function _parseResponse(data, jsonMode) {
  const content = data.choices?.[0]?.message?.content;
  if (jsonMode && content) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }
  return content;
}

/**
 * LangChain-style tool execution:
 * Given a user message, pick the right tool and execute it
 */
async function agentExecute(systemPrompt, userMessage, tools, options = {}) {
  const toolDescriptions = tools.map(t => 
    `- ${t.name}: ${t.description}. Parameters: ${JSON.stringify(t.parameters)}`
  ).join('\n');

  const messages = [
    {
      role: 'system',
      content: `${systemPrompt}

You have access to these tools:
${toolDescriptions}

IMPORTANT RULES:
1. ONLY use the tools provided. Never make up data.
2. Respond with a JSON object: {"tool": "tool_name", "params": {...}} or {"response": "text"} if no tool needed.
3. If you cannot fulfill the request with available tools, say so honestly.
4. Never hallucinate listings, prices, or transaction data.`
    },
    { role: 'user', content: userMessage }
  ];

  const result = await callLLM(messages, { ...options, jsonMode: true });

  if (typeof result === 'object' && result.tool) {
    const tool = tools.find(t => t.name === result.tool);
    if (!tool) {
      return { error: `Unknown tool: ${result.tool}` };
    }
    try {
      const toolResult = await tool.execute(result.params || {});
      return { tool: result.tool, result: toolResult };
    } catch (err) {
      return { tool: result.tool, error: err.message };
    }
  }

  return { response: result?.response || result };
}

module.exports = { callLLM, agentExecute, getCopilotToken, getGitHubToken };
