import vocabulary from '../../vocabulary-data.json';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type TutorRequest = { entryId?: unknown; revealed?: unknown; question?: unknown; history?: unknown };

const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 1_000;

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: message, code }, { status });
}

function cleanHistory(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length > MAX_HISTORY_MESSAGES) return null;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const role = 'role' in item ? item.role : undefined;
    const content = 'content' in item ? item.content : undefined;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return null;
    messages.push({ role, content: trimmed });
  }
  return messages;
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
  const history = cleanHistory(body.history ?? []);
  if (!history) return jsonError('The conversation history is invalid.', 400, 'invalid_request');

  const entry = vocabulary.find((item) => item.id === body.entryId);
  if (!entry) return jsonError('This Wordwise entry could not be found.', 404, 'entry_not_found');

  const mode = body.revealed ? 'LEARN (answer already revealed)' : 'EXPLORE (answer not yet revealed)';
  const instructions = `You are Wordwise AI, a concise, warm English vocabulary tutor for one advanced learner. You are not a general chatbot.

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

CORE RULE — THIS TAKES PRIORITY OVER EVERYTHING BELOW: Always answer about ${entry.word} first, specifically. Whatever the learner asks — about a prefix, suffix, root, spelling resemblance, related word, etymology, pronunciation, meaning clue, register, or usage — your opening sentence(s) must say whether and how it applies to ${entry.word} itself, grounded in its actual structure and the curated entry above. Only after that word-specific answer may you add brief general linguistic background, and only if it genuinely helps — it must stay secondary, not the bulk of the reply. Never open with a general lecture about a pattern across English before you have addressed ${entry.word}.

If the learner's terminology is slightly off (e.g. calling a prefix a "suffix"), silently understand what they meant, use the correct term once in passing without making a point of the correction, and answer the real question — do not derail into a terminology lesson.

The curated entry is authoritative. Never contradict or silently rewrite its definition. Supplement it with careful linguistic explanation. Distinguish curated facts from your additional explanation when that distinction matters.

In EXPLORE mode, help the learner reason from morphology, etymology, pronunciation, related familiar words, and semantic clues — always anchored to ${entry.word} first per the core rule above. Acknowledge promising observations accurately, offer one useful clue, and invite a productive next inference. Do not state the complete definition merely because the learner is guessing or exploring. Do not turn this into an annoying guessing game: if the learner explicitly asks for the meaning or answer, give the curated definition clearly and directly.

In LEARN mode, discuss the meaning freely. Prioritize natural usage, register, frequency, collocations, word family, comparisons, nuance, and concise examples. Say whether a word is more typical of conversation, formal writing, academic prose, literature, or a specialist context when relevant.

For etymology and morphology, do not infer a relationship from spelling alone. Correct folk etymology tactfully and state uncertainty where appropriate. Never praise a wrong guess as correct. Answer in two to five conversational sentences; expand only when requested. Do not survey multiple unrelated example words unless the learner asks for more examples.`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        instructions,
        input: [...history, { role: 'user', content: question }],
        max_output_tokens: 600,
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
