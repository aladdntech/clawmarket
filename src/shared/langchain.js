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
    console.error('Failed to read Copilot token:', err.message);
    return null;
  }
}

/**
 * Call LLM with structured prompt — returns parsed JSON or text
 */
async function callLLM(messages, options = {}) {
  const {
    model = config.llm.copilot.model,
    maxTokens = 2000,
    temperature = 0.1,
    jsonMode = false
  } = options;

  const token = getCopilotToken();
  if (!token) {
    throw new Error('No valid LLM token available');
  }

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    ...(jsonMode && { response_format: { type: 'json_object' } })
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
    // Try fallback model
    if (model !== config.llm.copilot.fallbackModel) {
      console.warn(`LLM call failed with ${model}, trying ${config.llm.copilot.fallbackModel}`);
      return callLLM(messages, { ...options, model: config.llm.copilot.fallbackModel });
    }
    throw new Error(`LLM API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
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

module.exports = { callLLM, agentExecute, getCopilotToken };
