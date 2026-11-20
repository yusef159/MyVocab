import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateWords, suggestMeanings } from './openai.js';

test('both AI word flows return English definition choices in the initial request', async () => {
  const requests: { messages: { content: string }[] }[] = [];
  const suggestion = {
    english: 'bright', arabicMeanings: ['test'], exampleSentences: ['The sun is bright.'],
    englishMeaningOptions: [' Full of light ', 'Quick to learn', 'Full of light', '', 42],
  };
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(
      requests.length === 1 ? [suggestion] : suggestion
    ) } }] }));
  });
  const previousKey = process.env.OPENAI_API_KEY;
  const previousUrl = process.env.OPENAI_BASE_URL;
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.OPENAI_API_KEY = 'local-test-key';
    process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
    const generated = await generateWords(1, 'daily life', 'B1');
    const suggested = await suggestMeanings('bright');
    for (const word of [generated[0], suggested]) {
      assert.deepEqual(word.englishMeaningOptions, ['Full of light', 'Quick to learn']);
      assert.deepEqual(word.arabicMeanings, suggestion.arabicMeanings);
      assert.deepEqual(word.exampleSentences, suggestion.exampleSentences);
    }
    assert.equal(requests.length, 2, 'each word flow includes definitions without a separate explanation request');
    for (const request of requests) {
      assert.match(request.messages[0].content, /englishMeaningOptions/);
    }
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previousUrl;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
