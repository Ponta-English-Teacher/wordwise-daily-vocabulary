'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import vocabulary from './vocabulary-data.json';

type Status = 'known' | 'unsure' | 'learning';
type RecordMap = Record<string, { status: Status; seen: number; due: number }>;
type Voice = 'female' | 'male';
type TutorMessage = { role: 'user' | 'assistant'; content: string };
type Entry = (typeof vocabulary)[number] & {
  audioReady?: boolean;
  audioUSFemale?: string;
  audioUSMale?: string;
};

const DAY = 86_400_000;
const shuffle = <T,>(items: T[]) =>
  items.map((item) => ({ item, order: Math.random() })).sort((a, b) => a.order - b.order).map(({ item }) => item);

export default function Home() {
  const entries = vocabulary as Entry[];
  const [records, setRecords] = useState<RecordMap>({});
  const [queue, setQueue] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<Entry>(entries[0]);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState<Status | null>(null);
  const [view, setView] = useState<'session' | 'progress'>('session');
  const [session, setSession] = useState({ seen: 0, known: 0, unsure: 0, learning: 0 });
  const [voice, setVoice] = useState<Voice>('female');
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorPending, setTutorPending] = useState(false);
  const [tutorError, setTutorError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentEntryIdRef = useRef(current.id);

  useEffect(() => {
    audioRef.current?.pause();
    currentEntryIdRef.current = current.id;
    setTutorMessages([]);
    setTutorQuestion('');
    setTutorError('');
    setTutorPending(false);
  }, [current.id]);

  const tutorSuggestions = revealed
    ? ['When would I use this?', 'Conversation or writing?', 'What is the register?', 'Similar words?', 'Give me a natural example.']
    : ['Is it related to a word I know?', 'Can I guess from the parts?', 'Am I close?'];

  async function askTutor(suggestedQuestion?: string, retry = false) {
    const question = (suggestedQuestion ?? tutorQuestion).trim();
    if (!question || tutorPending) return;

    const entryId = current.id;
    const history = (retry ? tutorMessages.slice(0, -1) : tutorMessages).slice(-10);
    if (!retry) setTutorMessages((messages) => [...messages, { role: 'user', content: question }]);
    setTutorQuestion('');
    setTutorError('');
    setTutorPending(true);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, revealed, question, history }),
      });
      const payload = await response.json().catch(() => null) as { answer?: string; error?: string } | null;
      if (!response.ok || !payload?.answer) throw new Error(payload?.error || 'Wordwise AI could not answer just now.');
      if (currentEntryIdRef.current === entryId) {
        setTutorMessages((messages) => [...messages, { role: 'assistant', content: payload.answer! }]);
      }
    } catch (error) {
      if (currentEntryIdRef.current === entryId) {
        setTutorError(error instanceof Error ? error.message : 'Wordwise AI could not answer just now.');
      }
    } finally {
      if (currentEntryIdRef.current === entryId) setTutorPending(false);
    }
  }

  function playPronunciation() {
    const src = voice === 'female' ? current.audioUSFemale : current.audioUSMale;
    if (!src) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.pause();
    audio.src = src;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  useEffect(() => {
    let saved: RecordMap = {};
    try { saved = JSON.parse(localStorage.getItem('wordwise-v2') || '{}'); } catch {}
    setRecords(saved);
    const due = entries.filter((entry) => saved[entry.word]?.status !== 'known' && (saved[entry.word]?.due || Infinity) <= Date.now());
    const fresh = entries.filter((entry) => !saved[entry.word]);
    const nextQueue = [...shuffle(due), ...shuffle(fresh), ...shuffle(entries.filter((entry) => saved[entry.word]?.status !== 'known'))];
    setQueue(nextQueue);
    setCurrent(nextQueue[0] || entries[0]);
  }, []);

  const counts = useMemo(
    () => Object.values(records).reduce((total, record) => ({ ...total, [record.status]: total[record.status] + 1 }), { known: 0, unsure: 0, learning: 0 }),
    [records],
  );

  function saveStatus(status: Status, countAsAnswer = true) {
    const interval = status === 'known' ? 90 : status === 'unsure' ? 2 : 1;
    const updated = { ...records, [current.word]: { status, seen: (records[current.word]?.seen || 0) + (countAsAnswer ? 1 : 0), due: Date.now() + interval * DAY } };
    setRecords(updated);
    localStorage.setItem('wordwise-v2', JSON.stringify(updated));
    setAnswer(status);
    setRevealed(true);
    if (countAsAnswer) setSession((previous) => ({ ...previous, seen: previous.seen + 1, [status]: previous[status] + 1 }));
  }

  function correctStatus(status: Status) {
    const oldStatus = answer;
    saveStatus(status, false);
    if (oldStatus) setSession((previous) => ({ ...previous, [oldStatus]: Math.max(0, previous[oldStatus] - 1), [status]: previous[status] + 1 }));
  }

  function next() {
    const remaining = queue.filter((entry) => entry.id !== current.id);
    const following = remaining[0] || shuffle(entries.filter((entry) => records[entry.word]?.status !== 'known'))[0] || entries[0];
    setQueue(remaining);
    setCurrent(following);
    setRevealed(false);
    setAnswer(null);
  }

  function reset() {
    if (!confirm('Clear all vocabulary progress and begin again?')) return;
    localStorage.removeItem('wordwise-v2');
    location.reload();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('session')}><span>W</span><b>Wordwise</b></button>
        <nav><button className={view === 'session' ? 'active' : ''} onClick={() => setView('session')}>Session</button><button className={view === 'progress' ? 'active' : ''} onClick={() => setView('progress')}>Progress</button></nav>
        <div className="bank"><strong>{entries.length}</strong><span> quality-checked entries</span></div>
      </header>

      {view === 'session' ? (
        <section className="workspace">
          <aside className="session-panel">
            <p className="eyebrow">TODAY&apos;S SESSION</p><h2>{session.seen}<span>/ 10</span></h2>
            <div className="meter"><i style={{ width: `${Math.min(100, session.seen * 10)}%` }} /></div>
            <dl><div><dt>Know</dt><dd>{session.known}</dd></div><div><dt>Unsure</dt><dd>{session.unsure}</dd></div><div><dt>Learning</dt><dd>{session.learning}</dd></div></dl>
            <p className="aside-note">Your first answer measures prior knowledge. The entry then appears for consolidation.</p>
          </aside>

          <section className="study">
            <div className="study-head"><div><p className="eyebrow">QUICK CALIBRATION</p><p className="instruction">Do you know this word well enough to explain it?</p></div><span className="level">{current.level}</span></div>
            <article className={`calibration-card ${revealed ? 'revealed' : ''}`} aria-live="polite">
              <p className="counter">{records[current.word]?.seen ? 'REVIEW' : 'NEW WORD'}</p>
              {!revealed ? (
                <>
                  <div className="word-line"><h1>{current.word}</h1><span>{current.ipa}</span></div>
                  <p className="prompt">Judge the word before seeing its meaning.</p>
                  <div className="choice-grid">
                    <button className="yes" onClick={() => saveStatus('known')}><span>✓</span><b>I know it</b><small>I could explain it</small></button>
                    <button onClick={() => saveStatus('unsure')}><span>~</span><b>I&apos;m unsure</b><small>It looks familiar</small></button>
                    <button onClick={() => saveStatus('learning')}><span>＋</span><b>I don&apos;t know it</b><small>Teach me this word</small></button>
                  </div>
                </>
              ) : (
                <div className="entry">
                  <div className="word-line"><h1>{current.word}</h1><span>{current.ipa}</span><em>{current.partOfSpeech}</em></div>
                  <p className="saved-status">{answer === 'known' ? 'Known — review and consolidate' : answer === 'unsure' ? 'Familiar — let’s strengthen it' : 'New — added to learning'}</p>
                  <p className="definition">{current.definition}</p>
                  <p className="entry-detail"><b>Example:</b> {current.context}</p>
                  {current.usage && <p className="entry-detail"><b>Usage:</b> {current.usage}</p>}
                  <p className="learning-type"><b>{current.learningType === 'active' ? 'Active vocabulary' : 'Receptive vocabulary'}</b> · {current.level}</p>
                  {current.audioReady && (
                    <div className="pronunciation">
                      <button type="button" className="play-audio" onClick={playPronunciation} aria-label="Play pronunciation">▶ Pronunciation</button>
                      <div className="voice-toggle" role="group" aria-label="Voice">
                        <button type="button" className={voice === 'female' ? 'active' : ''} onClick={() => setVoice('female')}>Female</button>
                        <button type="button" className={voice === 'male' ? 'active' : ''} onClick={() => setVoice('male')}>Male</button>
                      </div>
                    </div>
                  )}
                  <div className="correction"><span>Change my answer:</span>{(['known', 'unsure', 'learning'] as Status[]).filter((status) => status !== answer).map((status) => <button key={status} onClick={() => correctStatus(status)}>{status === 'known' ? 'I knew it' : status === 'unsure' ? 'I was unsure' : 'I didn’t know it'}</button>)}</div>
                  <button className="continue" onClick={next}>Continue <span>→</span></button>
                </div>
              )}
            </article>
            <section className="tutor" aria-labelledby="tutor-title">
              <div className="tutor-heading">
                <div><p className="eyebrow">ASK WORDWISE AI</p><h2 id="tutor-title">{revealed ? 'Learn more about this word' : 'Explore the word'}</h2></div>
                <span>{current.word}</span>
              </div>
              {tutorMessages.length > 0 && (
                <div className="tutor-conversation" aria-live="polite">
                  {tutorMessages.map((message, index) => <div className={`tutor-message ${message.role}`} key={`${message.role}-${index}`}><b>{message.role === 'user' ? 'You' : 'Wordwise AI'}</b><p>{message.content}</p></div>)}
                  {tutorPending && <div className="tutor-message assistant pending"><b>Wordwise AI</b><p>Thinking about {current.word}…</p></div>}
                </div>
              )}
              <div className="tutor-suggestions">
                {tutorSuggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => askTutor(suggestion)} disabled={tutorPending}>{suggestion}</button>)}
              </div>
              <div className="tutor-compose">
                <textarea aria-label={`Ask Wordwise AI about ${current.word}`} value={tutorQuestion} onChange={(event) => setTutorQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); askTutor(); } }} placeholder={revealed ? 'Ask about usage, register, nuance, or similar words…' : 'Share a guess or ask about the word’s parts…'} rows={2} maxLength={1000} disabled={tutorPending} />
                <button type="button" onClick={() => askTutor()} disabled={tutorPending || !tutorQuestion.trim()}>{tutorPending ? 'Sending…' : 'Ask'}</button>
              </div>
              {tutorError && <div className="tutor-error" role="alert"><span>{tutorError}</span><button type="button" onClick={() => askTutor(tutorMessages.at(-1)?.role === 'user' ? tutorMessages.at(-1)?.content : undefined, true)} disabled={tutorPending}>Retry</button></div>}
              <p className="tutor-note">AI guidance supplements the curated Wordwise entry.</p>
            </section>
            <p className="privacy">Progress is saved privately on this device. Dictionary data adapted from Kaikki/Wiktionary (CC BY-SA).</p>
          </section>
        </section>
      ) : (
        <section className="progress-page">
          <p className="eyebrow">YOUR VOCABULARY MAP</p><h1>Progress</h1><p className="lede">Confident knowledge is kept separate from words that need another encounter.</p>
          <div className="stats"><article><span>✓</span><strong>{counts.known}</strong><p>Known</p></article><article><span>~</span><strong>{counts.unsure}</strong><p>Unsure</p></article><article><span>＋</span><strong>{counts.learning}</strong><p>Learning</p></article><article><span>Σ</span><strong>{Object.keys(records).length}</strong><p>Assessed</p></article></div>
          <div className="progress-card"><h3>Bank coverage</h3><div className="big-meter"><i style={{ width: `${Object.keys(records).length / entries.length * 100}%` }} /></div><p>{Object.keys(records).length} of {entries.length} entries assessed</p><button onClick={reset}>Reset all progress</button></div>
        </section>
      )}
      <footer><p>Educated recognition · Useful precision · No browser TTS</p><p>Review intervals adapt to your answers</p></footer>
    </main>
  );
}
