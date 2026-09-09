'use client';
import { useEffect, useMemo, useState } from 'react';

type Word = { word:string; pronunciation:string; part:string; definition:string; context:string; note:string };
const words: Word[] = [
  ['circumspect','/ˈsɜː.kəm.spekt/','adjective','Careful to consider possible risks before acting or speaking.','The committee was circumspect about promising results before the evidence had been reviewed.','Often describes thoughtful, restrained judgment.'],
  ['cogent','/ˈkəʊ.dʒənt/','adjective','Clear, logical, and convincing.','She gave a cogent explanation of why the curriculum needed to change.','Commonly used with argument, case, explanation, or reason.'],
  ['equivocal','/ɪˈkwɪv.ə.kəl/','adjective','Open to more than one interpretation; deliberately unclear or uncertain.','His equivocal reply left us unsure whether he supported the proposal.','Not the same as equal: it suggests ambiguity.'],
  ['pragmatic','/præɡˈmæt.ɪk/','adjective','Dealing with problems in a practical way rather than relying on theory.','Faced with a limited budget, the department adopted a pragmatic solution.','Usually approving, though it can imply compromise.'],
  ['salient','/ˈseɪ.li.ənt/','adjective','Most noticeable or important in a particular situation.','The summary identifies the most salient findings from the interviews.','Useful for highlighting what matters most.'],
  ['tenuous','/ˈten.ju.əs/','adjective','Weak, slight, or not strongly supported.','The link between the two events remains tenuous without further evidence.','Often used for a connection, claim, relationship, or hold.'],
  ['perfunctory','/pəˈfʌŋk.tər.i/','adjective','Done quickly and with little care or interest.','The manager gave the report only a perfunctory glance before the meeting.','Implies that a duty was done as a formality.'],
  ['prosaic','/prəˈzeɪ.ɪk/','adjective','Ordinary and lacking imagination or excitement.','The cause of the mysterious noise turned out to be entirely prosaic.','Literally also means written in prose, not verse.'],
  ['ubiquitous','/juːˈbɪk.wɪ.təs/','adjective','Present or found everywhere.','Smartphones have become ubiquitous in both professional and private life.','Stronger and more concise than “very common.”'],
  ['disparate','/ˈdɪs.pər.ət/','adjective','So different that comparison or combination seems difficult.','The course brings together students from disparate academic backgrounds.','Often used for groups, ideas, sources, or elements.'],
  ['intransigent','/ɪnˈtræn.sɪ.dʒənt/','adjective','Unwilling to change one’s views or agree about something.','Both sides remained intransigent, so the negotiations made little progress.','More forceful than stubborn, especially in formal contexts.'],
  ['ameliorate','/əˈmiː.li.ə.reɪt/','verb','To make a bad or difficult situation better.','The new support program is intended to ameliorate inequalities in access.','A formal alternative to improve or alleviate.'],
  ['laconic','/ləˈkɒn.ɪk/','adjective','Using very few words.','Her laconic email—“Approved. Proceed.”—ended weeks of discussion.','Can suggest admirable brevity or unfriendly terseness.'],
  ['magnanimous','/mæɡˈnæn.ɪ.məs/','adjective','Generous and forgiving, especially toward a rival or less powerful person.','She was magnanimous in victory and praised her opponent’s campaign.','Usually describes conduct after success or conflict.'],
  ['fastidious','/fæˈstɪd.i.əs/','adjective','Very attentive to accuracy, detail, or cleanliness.','A fastidious editor checked every citation and punctuation mark.','Can be praise for care or criticism of excessive fussiness.'],
  ['ostensible','/ɒˈsten.sə.bəl/','adjective','Appearing or stated to be true, though perhaps not actually true.','The ostensible purpose of the meeting was to review the schedule.','It often hints that the real reason is different.'],
  ['prescient','/ˈpres.i.ənt/','adjective','Showing knowledge of what will happen before it happens.','Her warning about data privacy now seems remarkably prescient.','Used for unusually accurate foresight.'],
  ['reticent','/ˈret.ɪ.sənt/','adjective','Unwilling to speak openly about one’s thoughts or feelings.','He was reticent about discussing the reasons for his resignation.','Traditionally means reserved in speech, not merely reluctant.'],
  ['trenchant','/ˈtren.tʃənt/','adjective','Expressed clearly and forcefully, often with sharp insight.','Her trenchant critique exposed a weakness in the conventional explanation.','Commonly modifies analysis, criticism, observation, or wit.'],
  ['capricious','/kəˈprɪʃ.əs/','adjective','Changing suddenly and unpredictably.','The capricious weather made it impossible to plan the outdoor event.','Can describe people, decisions, fortune, or weather.'],
  ['anodyne','/ˈæn.ə.daɪn/','adjective','Unlikely to cause offence or disagreement, sometimes to the point of being dull.','The official statement was so anodyne that it revealed almost nothing.','As a noun, it can also mean something that soothes pain.'],
  ['sanguine','/ˈsæŋ.ɡwɪn/','adjective','Optimistic, especially in a difficult situation.','Despite the disappointing figures, the director remained sanguine about recovery.','Formal and often paired with “about.”'],
  ['inchoate','/ɪnˈkəʊ.ət/','adjective','Only partly formed or not yet clearly developed.','Their inchoate idea gradually became a detailed research proposal.','Useful for early ideas, feelings, movements, or systems.'],
  ['parsimonious','/ˌpɑː.sɪˈməʊ.ni.əs/','adjective','Extremely unwilling to spend money or use resources; also, economical in explanation.','The most parsimonious account explains all three findings with one principle.','In scholarship, it often means simple without needless assumptions.'],
].map(([word,pronunciation,part,definition,context,note])=>({word,pronunciation,part,definition,context,note}));
const dayNumber=()=>Math.floor(Date.now()/86400000);

export default function Home(){
 const [known,setKnown]=useState<string[]>([]), [learning,setLearning]=useState<string[]>([]), [offset,setOffset]=useState(0), [ready,setReady]=useState(false);
 useEffect(()=>{try{setKnown(JSON.parse(localStorage.getItem('wordwise-known')||'[]'));setLearning(JSON.parse(localStorage.getItem('wordwise-learning')||'[]'))}catch{}setReady(true)},[]);
 const available=useMemo(()=>words.filter(x=>!known.includes(x.word)),[known]);
 const current=available[(dayNumber()+offset)%available.length]||words[(dayNumber()+offset)%words.length];
 const isLearning=learning.includes(current.word);
 const save=(k:string[],l:string[])=>{setKnown(k);setLearning(l);localStorage.setItem('wordwise-known',JSON.stringify(k));localStorage.setItem('wordwise-learning',JSON.stringify(l))};
 const markKnown=()=>{save([...new Set([...known,current.word])],learning.filter(w=>w!==current.word));setOffset(v=>v+1)};
 const markLearning=()=>{save(known,isLearning?learning.filter(w=>w!==current.word):[...learning,current.word]);setOffset(v=>v+1)};
 return <main className="app-shell">
  <header className="topbar"><a className="brand" href="#top"><span>W</span> Wordwise</a><div className="progress"><span className="progress-label">Your progress</span><strong>{ready?known.length:0}</strong><span> known</span></div></header>
  <section className="hero" id="top"><p className="eyebrow">A WORD FOR TODAY</p><p className="date">{new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</p>
   <article className="word-card" aria-live="polite">
    <div className="word-heading"><div><h1>{current.word}</h1><p><span>{current.pronunciation}</span><i>·</i><em>{current.part}</em></p></div><button className="sound" aria-label={`Hear ${current.word}`} onClick={()=>speechSynthesis.speak(new SpeechSynthesisUtterance(current.word))}>◖<span> Listen</span></button></div>
    <div className="definition"><span className="number">01</span><div><h2>Meaning</h2><p>{current.definition}</p></div></div>
    <blockquote>“{current.context}”</blockquote><p className="usage"><span>Usage note</span>{current.note}</p>
    <div className="actions"><button className="known" onClick={markKnown}>I know this word <span>✓</span></button><button className="learning" onClick={markLearning}>{isLearning?'Remove from learning':'Learn this word'} <span>→</span></button></div>
   </article><button className="another" onClick={()=>setOffset(v=>v+1)}>Show me another word <span>↻</span></button>
  </section><footer><p><strong>{learning.length}</strong> saved to learn</p><p>Chosen for advanced learners · Useful, precise, and widely understood</p></footer>
 </main>
}
