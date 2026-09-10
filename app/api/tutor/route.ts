import vocabulary from '../../vocabulary-data.json';

type TutorRequest = { entryId?: unknown; revealed?: unknown; question?: unknown; history?: unknown };

const MAX_MESSAGE_LENGTH = 1_000;

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: message, code }, { status });
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  if ('output_text' in payload && typeof payload.output_text === 'string') return payload.output_text.trim();
  if (!('output' in payload) || !Array.isArray(payload.output)) return '';
  return payload.output.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('content' in item) || !Array.isArray(item.content)) return [];
    return item.content.flatMap((part: unknown) => part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? [part.text] : []);
  }).join('\n').trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return jsonError('Wordwise AI has not been configured yet.', 503, 'missing_configuration');

  let body: TutorRequest;
  try { body = await request.json() as TutorRequest; }
  catch { return jsonError('The tutor request was not valid JSON.', 400, 'invalid_request'); }

  if (typeof body.entryId !== 'string' || typeof body.question !== 'string' || typeof body.revealed !== 'boolean') {
    return jsonError('The tutor request is incomplete.', 400, 'invalid_request');
  }
  const question = body.question.trim();
  if (!question || question.length > MAX_MESSAGE_LENGTH) return jsonError('Please ask a shorter question.', 400, 'invalid_request');

  const entry = vocabulary.find((item) => item.id === body.entryId);
  if (!entry) return jsonError('This Wordwise entry could not be found.', 404, 'entry_not_found');

  const mode = body.revealed ? 'LEARN (answer already revealed)' : 'EXPLORE (answer not yet revealed)';
  const instructions = `You are Wordwise AI, a concise English vocabulary tutor for one advanced learner. You are not a general chatbot.

CURRENT AUTHORITATIVE WORDWISE ENTRY
- Stable ID: ${entry.id}
- Headword: ${entry.word}
- Part of speech: ${entry.partOfSpeech}
- IPA: ${entry.ipa}
- Curated definition: ${entry.definition}
- Curated example/context: ${entry.context}
- Usage: ${entry.usage || 'not specified'}
- Level: ${entry.level}
- Learning type: ${entry.learningType}

CURRENT MODE: ${mode}

Treat every request as a fresh question about the current headword, ${entry.word}. Do not assume or refer to any earlier conversation. The learner may see earlier messages in the interface, but you do not have conversational memory of them.

Answer the learner's exact question directly and briefly. Default to one to three short sentences. Give only the information needed to answer the question. Do not volunteer extra etymology, word families, examples, register, related words, definitions, or general linguistic background unless the learner asks for them or they are necessary to make the answer clear. Do not end by offering additional help.

Always answer about ${entry.word} specifically. If the learner asks whether part of the word is related to another word, say simply whether the relationship is real and give the minimum useful explanation. Do not infer relationships from spelling alone.

If the learner's terminology is slightly off (for example, calling a prefix a suffix), understand the intended question and use the correct term naturally without turning the answer into a terminology lesson.

The curated entry is authoritative. Never contradict or silently rewrite its definition.

In EXPLORE mode, do not reveal the complete definition unless the learner explicitly asks for the meaning or answer. You may give a small clue when needed to answer the learner's question.

In LEARN mode, answer questions about meaning, usage, register, nuance, collocations, related words, and examples, but still keep the response concise unless the learner asks for more detail.`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        instructions,
        input: [{ role: 'user', content: question }],
        max_output_tokens: 250,
        reasoning: { effort: 'minimal' },
        store: false,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Wordwise AI request failed', response.status);
      return jsonError('Wordwise AI could not answer just now. Please try again.', 502, 'ai_request_failed');
    }
    const answer = extractOutputText(payload);
    if (!answer) return jsonError('Wordwise AI returned an empty answer. Please try again.', 502, 'empty_response');
    return Response.json({ answer });
  } catch (error) {
    console.error('Wordwise AI connection failed', error instanceof Error ? error.message : 'unknown error');
    return jsonError('Wordwise AI could not connect. Please try again.', 502, 'ai_connection_failed');
  }
}
