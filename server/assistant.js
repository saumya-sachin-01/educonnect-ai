// Fallback Study Assistant — local rule-based engine.
// NO external AI API is configured. Every response is labeled as demo output.

export const ASSISTANT_NOTICE = 'DEMO ASSISTANT — no live AI API is configured. Responses are generated locally by a rule-based educational engine and are illustrative only.';

const STOP = new Set(('the a an and or but if then of in on for with to from by is are was were be been it its this that these those as at we you they he she i not no do does did can will would should could').split(' '));

function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

function keywords(text) {
  const freq = new Map();
  for (const w of String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w.length < 4 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return freq;
}

const KB = [
  { keys: ['database', 'normalization', 'sql', 'dbms', 'relation', 'schema', 'acid', 'transaction'],
    reply: 'Databases store structured data so it stays accurate and easy to query. Key ideas: (1) Tables/relations hold rows of data; (2) Primary keys identify each row, foreign keys link tables; (3) Normalization (1NF→3NF) removes redundancy; (4) ACID guarantees keep transactions safe; (5) SQL uses SELECT/WHERE/GROUP BY/JOIN to retrieve data. Ask me to summarize pasted notes or generate revision questions for a deeper drill.' },
  { keys: ['data structure', 'stack', 'queue', 'linked list', 'tree', 'graph', 'hash', 'heap', 'array'],
    reply: 'Data structures organize data for efficient access. Arrays give O(1) index access; linked lists give O(1) insertion; stacks are LIFO (undo, recursion), queues are FIFO (scheduling); hash tables average O(1) lookup; trees enable O(log n) search when balanced; graphs model networks. Choosing the right structure is usually the biggest performance win in a program.' },
  { keys: ['algorithm', 'complexity', 'big o', 'sorting', 'searching', 'recursion', 'dynamic programming', 'greedy'],
    reply: 'An algorithm is a step-by-step procedure to solve a problem. Analyze it with Big-O notation: O(1) constant, O(log n) binary search, O(n) linear, O(n log n) good sorts, O(n²) naive sorts/pair loops, O(2ⁿ) exponential (avoid). General strategy: brute force first, then optimize with sorting, hashing, two pointers, or dynamic programming when subproblems repeat.' },
  { keys: ['network', 'tcp', 'udp', 'ip', 'osi', 'router', 'protocol', 'http', 'dns'],
    reply: 'Computer networks connect machines via layered protocols. The OSI/TCP-IP model: Link → Internet (IP addressing/routing) → Transport (TCP = reliable, ordered; UDP = fast, best-effort) → Application (HTTP, DNS, FTP). DNS resolves names to IPs, TCP adds reliability with handshakes and retransmission, and HTTP carries web requests. Ask for a summary of your own notes anytime.' },
  { keys: ['operating system', 'process', 'thread', 'scheduling', 'deadlock', 'memory', 'paging', 'os '],
    reply: 'An operating system manages hardware for applications. Core ideas: processes vs threads (threads share memory, processes do not), CPU scheduling (round-robin, priority), deadlock = circular wait + hold-and-wait + no preemption + mutual exclusion, and memory management via paging/virtual memory so each process gets isolated address space.' },
  { keys: ['python', 'java', 'javascript', 'programming', 'compiler', 'variable', 'function', 'loop'],
    reply: 'Programming fundamentals transfer across languages: variables store data, functions encapsulate logic, loops repeat work, and conditionals branch. Compiled languages (Java, C++) catch more errors before running; interpreted ones (Python, JavaScript) iterate faster. Master one language deeply — data types, control flow, functions, then OOP — and the second language becomes easy.' },
  { keys: ['machine learning', 'artificial intelligence', 'neural', 'model', 'training', 'ai '],
    reply: 'AI/ML teaches programs from data instead of explicit rules. Machine learning splits into supervised learning (labeled data → prediction), unsupervised (find structure/clusters), and reinforcement (reward-driven agents). A model trains by adjusting parameters to minimize a loss function, then generalizes to unseen data — watch for overfitting with held-out validation sets.' },
  { keys: ['revision', 'exam', 'study', 'prepare', 'tip'],
    reply: 'Evidence-based study tips: (1) Space repetition over multiple short sessions beats one long cram; (2) Active recall — close the book and test yourself; (3) Past papers reveal examiner patterns; (4) Teach a topic out loud to expose gaps (Feynman technique). Paste your notes here and I will generate practice questions.' },
];

function chatReply(message) {
  const m = ' ' + String(message || '').toLowerCase() + ' ';
  let best = null, bestScore = 0;
  for (const item of KB) {
    let score = 0;
    for (const k of item.keys) if (m.includes(k)) score += k.length;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  if (best) return best.reply;
  return `I can help with academic questions across common CS subjects (databases, data structures, algorithms, networks, OS, programming, AI). Try asking "explain normalization", "what is a stack", or paste your study notes and choose Summarize or Generate Questions. (This is the local demo assistant — connect an AI API for open-ended answers.)`;
}

function summarize(text) {
  const sents = sentences(text);
  if (sents.length === 0) return 'Please paste at least a few sentences of study material to summarize.';
  if (sents.length <= 3) return 'Summary: ' + sents.join(' ');
  const freq = keywords(text);
  const scored = sents.map((s, i) => {
    let score = 0;
    for (const w of s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) score += freq.get(w) || 0;
    return { s, i, score: score / Math.sqrt(s.length) };
  });
  const topN = Math.max(2, Math.ceil(sents.length * 0.35));
  const picked = scored.sort((a, b) => b.score - a.score).slice(0, topN).sort((a, b) => a.i - b.i);
  return picked.map((p) => p.s).join(' ');
}

const STEM_PATTERNS = [
  (s) => `Explain the following in your own words: "${trimQ(s)}"`,
  (s) => `What is the significance of: "${trimQ(s)}"?`,
  (s) => `How would you apply this idea in an exam answer: "${trimQ(s)}"?`,
];

function trimQ(s) {
  let t = s.replace(/[.!?]+$/, '');
  if (t.length > 120) t = t.slice(0, 117) + '...';
  return t;
}

function generateQuestions(text) {
  const sents = sentences(text);
  if (sents.length === 0) return ['Paste study material first, then choose "Generate Questions".'];
  const qs = [];
  sents.slice(0, 6).forEach((s, i) => {
    qs.push(STEM_PATTERNS[i % STEM_PATTERNS.length](s));
  });
  qs.push('Write a short summary (5–6 lines) of the whole passage from memory.');
  return qs;
}

export function assistantReply({ action = 'chat', message = '', text = '', topics = [] }) {
  if (action === 'summarize') return { reply: summarize(text), notice: ASSISTANT_NOTICE };
  if (action === 'questions') return { reply: generateQuestions(text), notice: ASSISTANT_NOTICE, list: true };
  if (action === 'topics') {
    if (topics && topics.length) {
      return {
        reply: topics.map((t, i) => `${i + 1}. ${t.label} — ${t.why}`),
        notice: ASSISTANT_NOTICE + ' Suggestions are computed from your real grades in this demo database.',
        list: true,
      };
    }
    return { reply: 'Once you have graded submissions, I will suggest revision topics based on your weakest courses.', notice: ASSISTANT_NOTICE };
  }
  return { reply: chatReply(message), notice: ASSISTANT_NOTICE };
}
