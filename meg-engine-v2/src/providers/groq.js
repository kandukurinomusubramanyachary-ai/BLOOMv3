const { OpenAICompatibleProvider } = require('./openaiCompatible');

class GroqProvider extends OpenAICompatibleProvider {
  constructor(config = {}) {
    super({ name: 'groq', apiKey: config.apiKey, model: config.model || 'openai/gpt-oss-20b', baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1' });
  }

  requestBody(request) {
    const body = super.requestBody(request);
    if (this.model.startsWith('openai/gpt-oss-')) {
      delete body.max_tokens;
      // The completion cap includes reasoning. Reserve room for a visible reply.
      body.max_completion_tokens = Math.max(2048, (request.maxTokens || 900) + 1024);
      body.reasoning_effort = 'low';
      body.include_reasoning = false;
    }
    return body;
  }
}

module.exports = { GroqProvider };
