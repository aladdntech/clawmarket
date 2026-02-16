require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3001'),
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/clawmarket',
    dbName: process.env.DB_NAME || 'clawmarket'
  },
  
  redis: {
    url: process.env.REDIS_URL || null
  },
  
  tron: {
    fullHost: process.env.TRON_FULL_HOST || 'https://api.trongrid.io',
    apiKey: process.env.TRONGRID_API_KEY || null,
    escrowAddress: process.env.TRON_ESCROW_ADDRESS || 'TLaigP2TLsc8rdyeF3wpZG8PbG3b1A38SX',
    escrowPrivateKey: process.env.TRON_ESCROW_PRIVATE_KEY || null,
    usdtContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    feeRate: 0.005 // 0.5%
  },
  
  llm: {
    provider: 'copilot', // 'copilot' | 'github-models' | 'openai'
    copilot: {
      endpoint: 'https://api.individual.githubcopilot.com/chat/completions',
      tokenFile: process.env.COPILOT_TOKEN_FILE || '/Users/isra/.openclaw/credentials/github-copilot.token.json',
      model: process.env.LLM_MODEL || 'claude-opus-4.5',
      fallbackModel: 'gpt-5.2',
      headers: {
        'Editor-Version': 'vscode/1.96.0',
        'Editor-Plugin-Version': 'copilot/1.250.0',
        'Copilot-Integration-Id': 'vscode-chat',
        'OpenAI-Intent': 'conversation-panel'
      }
    },
    githubModels: {
      endpoint: 'https://models.inference.ai.azure.com',
      model: 'gpt-4o'
    }
  },
  
  escrow: {
    digitalAutoReleaseHours: 72,
    physicalAutoReleaseDays: 7,
    disputeWindowHours: 48
  },
  
  platform: {
    name: 'ClawMarket',
    version: '0.1.0',
    feeRate: 0.005
  }
};
