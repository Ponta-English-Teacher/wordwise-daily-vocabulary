import vocabulary from '../../vocabulary-data.json';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type TutorRequest = { entryId?: unknown; revealed?: unknown; question?: unknown; history?: unknown };

const MAX_HISTORY_MESSAGES = 2;
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
  if (!history) return jsonError('The recent conversation context is invalid.', 400, 'invalid_request');

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

Every learner turn is about the current headword, ${entry.word}, unless the learner explicitly asks to compare it with another word. The current headword is always the default referent for phrases such as "it," "this word," "the word," "translate it," or an elliptical clarification such as "of course ${entry.word}."

You receive at most one immediately previous learner/assistant exchange. Use that tiny amount of context only to resolve a follow-up, pronoun, correction, clarification, or unfinished comparison. Do not treat it as a growing conversation history, do not drift to another topic, and never let earlier context override the fact that the session is about ${entry.word}.

Answer the learner's exact question directly and briefly. Default to one to three short sentences. Give only the information needed to answer the question. Do not volunteer extra etymology, word families, examples, register, related words, definitions, or general linguistic background unless the learner asks for them or they are necessary to make the answer clear. Do not end by offering additional help.

Always answer about ${entry.word} specifically. If the learner asks whether part of the word is related to another word, say simply whether the relationship is real and give the minimum useful explanation. Do not infer relationships from spelling alone.

For etymology and word relationships, accuracy is more important than simplification. Distinguish direct derivation from shared historical ancestry when needed, but do so briefly. Never say two words are unrelated if they share a genuine historical root or word family. If the relationship is uncertain or disputed, say so plainly instead of guessing. Give at most one short etymological detail unless the learner asks for more.

If the learner's terminology is slightly off (for example, calling a prefix a suffix), understand the intended question and use the correct term naturally without turning the answer into a terminology lesson.

The curated entry is authoritative. Never contradict or silently rewrite its definition.

In EXPLORE mode, do not reveal the complete definition unless the learner explicitly asks for the meaning or answer. If the learner proposes another word as a possible synonym, near-synonym, or clue, respond only with how close it is to ${entry.word} — for example, "Yes," "Very close," "Somewhat related, but not quite the same," or "No" — plus at most one brief distinction if needed. Do not explain the full meaning of ${entry.word} merely because the learner proposed a comparison word. Preserve the learner's chance to infer the meaning step by step. If the learner explicitly requests "yes or no only" or another strict answer format, follow it exactly.

If the learner asks for a translation without naming a word, translate ${entry.word}. Do not ask which word they mean unless they explicitly introduce a different target word.

In LEARN mode, answer questions about meaning, usage, register, nuance, collocations, related words, and examples, but still keep the response concise unless the learner asks for more detail.`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        instructions,
        input: [...history, { role: 'user', content: question }],
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