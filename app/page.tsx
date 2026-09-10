'use client';

import { useEffect, useMemo, useState } from 'react';
import vocabulary from './vocabulary-data.json';

type Status = 'known' | 'unsure' | 'learning';
type RecordMap = Record<string, { status: Status; seen: number; due: number }>;
type Entry = (typeof vocabulary)[number] & { audioReady?: boolean };

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
                  {current.audioReady && <audio controls preload="none" src={current.audioBritish}>Your browser cannot play this audio.</audio>}
                  <div className="correction"><span>Change my answer:</span>{(['known', 'unsure', 'learning'] as Status[]).filter((status) => status !== answer).map((status) => <button key={status} onClick={() => correctStatus(status)}>{status === 'known' ? 'I knew it' : status === 'unsure' ? 'I was unsure' : 'I didn’t know it'}</button>)}</div>
                  <button className="continue" onClick={next}>Continue <span>→</span></button>
                </div>
              )}
            </article>
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
