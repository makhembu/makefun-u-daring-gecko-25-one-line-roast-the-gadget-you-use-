import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUTPUT_PATH = "/output/entry.txt";
const MAX_CHARS = 200;
const MIN_CHARS = 1;

type Candidate = {
  text: string;
  gadget: string;
  angle: string;
  concreteDetail: string;
};

type Validation = {
  ok: boolean;
  reason: string;
};

type ScoreBreakdown = {
  total: number;
  length: number;
  gadget: number;
  concrete: number;
  punch: number;
  specificity: number;
  freshness: number;
  structure: number;
  penalties: number;
};

type Ranked = {
  candidate: Candidate;
  breakdown: ScoreBreakdown;
  length: number;
};

const DAILY_GADGETS = [
  "phone",
  "smartwatch",
  "watch",
  "robot vacuum",
  "vacuum",
  "fridge",
  "refrigerator",
  "printer",
  "router",
  "wi-fi",
  "wifi",
  "speaker",
  "laptop",
  "earbuds",
  "headphones",
  "tv",
  "television",
  "kettle",
  "air fryer",
  "app",
  "autocorrect",
  "camera",
  "doorbell",
  "calendar",
  "maps",
  "email",
  "inbox",
  "weather",
  "light",
  "bulb",
  "microwave",
  "charger",
  "streaming",
  "toaster",
];

const CLICHE_PATTERNS: RegExp[] = [
  /\b(dies?|dead|dying)\b[^.!?]*\b(battery|charge|percent|20%)\b/i,
  /\basks? (me )?for a rating\b/i,
  /\blow[- ]battery\b/i,
  /\bfirmware update\b/i,
  /\bworst (phone|app|gadget)\b/i,
  /\bcan'?t live without\b/i,
  /\bfirst[- ]world problem\b/i,
  /\bwe'?ve all been there\b/i,
  /\bwho else\b/i,
  /\bme too\b/i,
];

const CONCRETE_MARKERS =
  /\b(\d+|one|two|three|four|five|twelve|thousand|morning|night|afternoon|evening|today|every|same|twice|always|never|still|before|after|again|while)\b/gi;

const PUNCH_MARKERS =
  /\b(still|like|yet|so|which|honestly|apparently|except|than|then)\b/gi;

const SPECIFICITY_MARKERS =
  /\b(grievance|hr|pilot|licen[cs]e|promotion|manager|mapped|filing|chaotic|coworker|corporate|magenta|commitment|storage|schedule|calendar|touchscreen|list|grocery|rationing|blackout|dentist|jenga|lathe|wizard|evidence|mystery|receipt|commentary|takeoff)\b/gi;

const ANALOGY_MARKERS = /\b(like|as if|than|which)\b/gi;

const OVERUSED_WORDS = new Set([
  "literally",
  "actually",
  "basically",
  "honestly",
  "vibes",
  "energy",
  "adulting",
  "obsessed",
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "then",
  "to",
  "when",
  "while",
  "with",
]);

const CANDIDATES: Candidate[] = [
  {
    text:
      "My router holds a perfect signal until I need it, then asks me to reconnect to the network I am already on.",
    gadget: "router",
    angle: "conditional loyalty",
    concreteDetail: "reconnect prompt on the network",
  },
  {
    text:
      "My robot vacuum has mapped every corner of my apartment and still treats the same chair leg like an unsolved mystery.",
    gadget: "robot vacuum",
    angle: "stubborn detective",
    concreteDetail: "same chair leg every time",
  },
  {
    text:
      "My robot vacuum only finds the one sock I dropped, then files it under the couch with the other evidence.",
    gadget: "robot vacuum",
    angle: "corrupt investigator",
    concreteDetail: "sock filed under the couch",
  },
  {
    text:
      "My fridge has Wi-Fi, a camera and a grocery list, but the milk still goes bad while it watches.",
    gadget: "fridge",
    angle: "overqualified witness",
    concreteDetail: "milk spoils under camera",
  },
  {
    text:
      "My watch counted four thousand steps today, three thousand nine hundred of them pacing while it told me to move.",
    gadget: "smartwatch",
    angle: "contradictory coach",
    concreteDetail: "3,900 pacing steps",
  },
  {
    text:
      "My phone's screen time report reads like a receipt for all the hours I spent ignoring it.",
    gadget: "phone",
    angle: "guilt with numbers",
    concreteDetail: "screen time receipt",
  },
  {
    text:
      "My phone's smart battery learned my schedule and now conserves power exactly when I need the map.",
    gadget: "phone",
    angle: "helpful at the wrong time",
    concreteDetail: "saves power during navigation",
  },
  {
    text:
      "My printer only works when I promise not to print anything important, and it knows when I am lying.",
    gadget: "printer",
    angle: "suspicious machine",
    concreteDetail: "fails on important jobs",
  },
  {
    text:
      "My smart speaker hears me whisper a secret and answers with an ad for the thing I only thought about.",
    gadget: "speaker",
    angle: "uncomfortable listener",
    concreteDetail: "ad for a passing thought",
  },
  {
    text:
      "My earbuds pair with my laptop, my phone and a stranger's speaker on the bus, but never with my meeting.",
    gadget: "earbuds",
    angle: "promiscuous pairing",
    concreteDetail: "connects to bus speaker",
  },
  {
    text:
      "My TV asks if I am still watching after two episodes, which is more attention than my group chat has given me.",
    gadget: "tv",
    angle: "needy appliance",
    concreteDetail: "are-you-still-watching prompt",
  },
  {
    text:
      "My laptop fan prepares for takeoff whenever I open a second browser tab, then cruises once I close it.",
    gadget: "laptop",
    angle: "overdramatic machine",
    concreteDetail: "second tab triggers the fan",
  },
  {
    text:
      "My kettle has an app, a schedule and a personality, but still cannot remember that I wanted tea, not steam.",
    gadget: "kettle",
    angle: "corporate appliance",
    concreteDetail: "forgets the tea",
  },
  {
    text:
      "My air fryer beeps three times to say it is done and twice more to remind me that it beeped.",
    gadget: "air fryer",
    angle: "redundant announcer",
    concreteDetail: "five completion beeps",
  },
  {
    text:
      "My video doorbell alerts me whenever a leaf moves, then misses the delivery standing in front of it.",
    gadget: "doorbell",
    angle: "selective attention",
    concreteDetail: "leaf alerts, missed delivery",
  },
  {
    text:
      "My calendar reminds me of meetings I am already late to, which is less a reminder than a little commentary.",
    gadget: "calendar",
    angle: "sarcastic assistant",
    concreteDetail: "late-meeting reminders",
  },
  {
    text:
      "My maps app reroutes me through a parking lot to save four seconds, then congratulates me for arriving.",
    gadget: "maps",
    angle: "unearned praise",
    concreteDetail: "parking-lot shortcut",
  },
  {
    text:
      "My inbox has twelve thousand unread emails and a search bar that cannot find the one I actually need.",
    gadget: "email",
    angle: "self-defeating archive",
    concreteDetail: "12,000 unread messages",
  },
  {
    text:
      "My weather app is mostly ads and slightly wrong about rain, so I have gone back to looking out the window.",
    gadget: "weather",
    angle: "analog regression",
    concreteDetail: "wrong about rain",
  },
  {
    text:
      "My smart lights forget the Wi-Fi whenever the router sneezes, so I clap at them like a confused wizard.",
    gadget: "light",
    angle: "ritual troubleshooting",
    concreteDetail: "clapping at disconnected bulbs",
  },
  {
    text:
      "My microwave clock has been wrong for three years and not one guest has ever had the courage to correct it.",
    gadget: "microwave",
    angle: "polite silence",
    concreteDetail: "three-year-old clock error",
  },
  {
    text:
      "My phone charger only works at the angle of a Jenga tower, and only while I hold my breath.",
    gadget: "charger",
    angle: "precarious engineering",
    concreteDetail: "Jenga-tower charging angle",
  },
  {
    text:
      "My watch congratulates me for standing up, which is the lowest bar any coach has ever set for me.",
    gadget: "watch",
    angle: "tiny victory",
    concreteDetail: "stand-up congratulation",
  },
  {
    text:
      "My streaming app checks if I am still there every hour, which is more follow-up than my dentist gives me.",
    gadget: "streaming",
    angle: "clingy service",
    concreteDetail: "hourly are-you-there check",
  },
  {
    text:
      "My smart toaster wants an account before it will toast bread, but at least it remembers my name.",
    gadget: "toaster",
    angle: "bureaucratic breakfast",
    concreteDetail: "account required to toast",
  },
  {
    text:
      "Autocorrect turned my running late into running a lathe, so my boss now thinks I have a hobby.",
    gadget: "autocorrect",
    angle: "unreliable translator",
    concreteDetail: "late replaced by lathe",
  },
];

function charCount(text: string): number {
  return Array.from(text).length;
}

function byteCount(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function normalizeText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToLimit(text: string, limit: number): string {
  if (charCount(text) <= limit) return text;
  const words = text.split(" ");
  let result = "";
  for (const word of words) {
    const next = result.length === 0 ? word : `${result} ${word}`;
    if (charCount(next) > limit) break;
    result = next;
  }
  if (result.length > 0) return result.replace(/[,;:.\-\u2013\u2014]+$/, "").trim();
  return Array.from(text).slice(0, limit).join("").trim();
}

function countMatches(text: string, pattern: RegExp): number {
  const globalPattern = pattern.global
    ? pattern
    : new RegExp(pattern.source, `${pattern.flags}g`);
  const matches = text.match(globalPattern);
  return matches === null ? 0 : matches.length;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

function hasControlCharacter(text: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text);
}

function validateEntry(text: string): Validation {
  if (text.length === 0) return { ok: false, reason: "empty text" };
  if (charCount(text) < MIN_CHARS) return { ok: false, reason: "too short" };
  if (charCount(text) > MAX_CHARS) return { ok: false, reason: "too long" };
  if (!/\S/.test(text)) return { ok: false, reason: "whitespace only" };
  if (/\r|\n/.test(text)) return { ok: false, reason: "not a single line" };
  if (text !== text.trim()) return { ok: false, reason: "untrimmed whitespace" };
  if (hasControlCharacter(text)) {
    return { ok: false, reason: "control character present" };
  }
  if (/https?:\/\/|www\./i.test(text)) {
    return { ok: false, reason: "url present" };
  }
  return { ok: true, reason: "valid" };
}

function scoreLength(length: number): number {
  if (length > MAX_CHARS) return -120;
  if (length >= 90 && length <= 165) return 16;
  if (length >= 70 && length < 90) return 10;
  if (length > 165 && length <= 188) return 6;
  if (length >= 40) return 2;
  return -8;
}

function scoreGadget(text: string): { score: number; hits: string[] } {
  const lower = text.toLowerCase();
  const hits = [...new Set(DAILY_GADGETS.filter((gadget) => lower.includes(gadget)))];
  if (hits.length === 0) return { score: -25, hits };
  return { score: 8 + Math.min(hits.length, 3) * 4, hits };
}

function findRepeatedContentWords(words: string[]): number {
  const counts = new Map<string, number>();
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  let repeated = 0;
  for (const count of counts.values()) {
    if (count > 1) repeated += count - 1;
  }
  return repeated;
}

function scoreFreshness(text: string): number {
  let score = 0;
  for (const pattern of CLICHE_PATTERNS) {
    if (pattern.test(text)) score -= 20;
  }
  const words = tokenize(text);
  for (const word of words) {
    if (OVERUSED_WORDS.has(word)) score -= 4;
  }
  score -= findRepeatedContentWords(words) * 5;
  score += Math.min(countMatches(text, ANALOGY_MARKERS), 3) * 2;
  return score;
}

function scoreStructure(text: string): number {
  const sentenceEnds = countMatches(text, /[.!?](?:\s|$)/g);
  let score = 0;
  if (sentenceEnds <= 2) score += 6;
  else score -= (sentenceEnds - 2) * 4;
  if (/[;:]/.test(text)) score += 1;
  if (/[\u2013\u2014]/.test(text)) score += 2;
  if (/[!?]{2,}|\.{3,}/.test(text)) score -= 8;
  if (!/[.!?]$/.test(text)) score -= 3;
  return score;
}

function scorePenalties(text: string, gadgetHits: number): number {
  let score = 0;
  if (/\bjudge\b/i.test(text)) score -= 60;
  if (gadgetHits === 0) score -= 10;
  if (/\b(rate|rating)\b/i.test(text) && /\b(open|start|launch)\b/i.test(text)) {
    score -= 10;
  }
  const words = tokenize(text);
  if (words.length < 8) score -= 8;
  if (words.length > 40) score -= 6;
  if (text === text.toUpperCase()) score -= 10;
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) score -= 30;
  if (/\b\d{7,}\b/.test(text)) score -= 30;
  return score;
}

function scoreBreakdown(candidate: Candidate): ScoreBreakdown {
  const text = normalizeText(candidate.text);
  const length = charCount(text);
  const gadget = scoreGadget(text);
  const breakdown: ScoreBreakdown = {
    total: 0,
    length: scoreLength(length),
    gadget: gadget.score,
    concrete: Math.min(countMatches(text, CONCRETE_MARKERS), 6) * 2,
    punch: Math.min(countMatches(text, PUNCH_MARKERS), 5) * 1.5,
    specificity: Math.min(countMatches(text, SPECIFICITY_MARKERS), 5) * 3,
    freshness: scoreFreshness(text),
    structure: scoreStructure(text),
    penalties: scorePenalties(text, gadget.hits.length),
  };
  breakdown.total =
    breakdown.length +
    breakdown.gadget +
    breakdown.concrete +
    breakdown.punch +
    breakdown.specificity +
    breakdown.freshness +
    breakdown.structure +
    breakdown.penalties;
  return breakdown;
}

function rankPool(pool: Candidate[], seen: Set<string> = new Set()): Ranked[] {
  return pool
    .filter((candidate) => {
      const key = normalizeText(candidate.text).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((candidate) => ({
      candidate,
      breakdown: scoreBreakdown(candidate),
      length: charCount(normalizeText(candidate.text)),
    }))
    .sort((a, b) => {
      if (b.breakdown.total !== a.breakdown.total) {
        return b.breakdown.total - a.breakdown.total;
      }
      if (a.length !== b.length) return a.length - b.length;
      return a.candidate.text.localeCompare(b.candidate.text);
    });
}

function buildPool(): Candidate[] {
  const seen = new Set<string>();
  const pool: Candidate[] = [];
  for (const candidate of CANDIDATES) {
    const text = trimToLimit(normalizeText(candidate.text), MAX_CHARS);
    const key = text.toLowerCase();
    if (text.length === 0 || seen.has(key)) continue;
    const check = validateEntry(text);
    if (!check.ok) continue;
    seen.add(key);
    pool.push({ ...candidate, text });
  }
  return pool;
}

function pickBest(pool: Candidate[]): Candidate | null {
  return rankPool(pool)[0]?.candidate ?? null;
}

function fallbackCandidate(): Candidate {
  return {
    text: trimToLimit(
      normalizeText(
        "My phone has one job and still asks me to rate the job before it does the job.",
      ),
      MAX_CHARS,
    ),
    gadget: "phone",
    angle: "self-defeating software",
    concreteDetail: "rating prompt before the task",
  };
}

function writeEntry(text: string): void {
  mkdirSync("/output", { recursive: true });
  writeFileSync(OUTPUT_PATH, text, { encoding: "utf8", flag: "w" });
}

function ensure(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runSelfTests(): string[] {
  const failures: string[] = [];
  const check = (name: string, body: () => void): void => {
    try {
      body();
    } catch (error) {
      failures.push(`${name}: ${(error as Error).message}`);
    }
  };

  check("charCount counts code points", () => {
    ensure(charCount("a\u{1F600}") === 2, "expected two code points");
  });
  check("byteCount counts utf8 bytes", () => {
    ensure(byteCount("\u{1F600}") === 4, "expected four bytes");
  });
  check("normalizeText collapses whitespace", () => {
    ensure(normalizeText(" a  b\tc ") === "a b c", "whitespace not collapsed");
  });
  check("trimToLimit respects the limit", () => {
    const trimmed = trimToLimit("alpha beta gamma delta", 11);
    ensure(charCount(trimmed) <= 11, `got ${trimmed.length} characters`);
    ensure(trimmed === "alpha beta", `unexpected trim: ${trimmed}`);
  });
  check("validate rejects newline and long text", () => {
    ensure(!validateEntry("a\nb").ok, "newline accepted");
    ensure(!validateEntry("x".repeat(MAX_CHARS + 1)).ok, "over-limit accepted");
  });
  check("validate rejects urls and control characters", () => {
    ensure(!validateEntry("see https://example.test now").ok, "url accepted");
    ensure(!validateEntry("bad\u0007text").ok, "control character accepted");
  });
  check("validate accepts the fallback", () => {
    ensure(validateEntry(fallbackCandidate().text).ok, "fallback rejected");
  });
  check("every candidate is valid and within limit", () => {
    for (const candidate of CANDIDATES) {
      const text = trimToLimit(normalizeText(candidate.text), MAX_CHARS);
      const result = validateEntry(text);
      ensure(result.ok, `${candidate.gadget}: ${result.reason}`);
    }
  });
  check("every candidate names a daily gadget", () => {
    for (const candidate of CANDIDATES) {
      const text = normalizeText(candidate.text);
      ensure(scoreGadget(text).hits.length > 0, `${candidate.gadget} not named`);
    }
  });
  check("candidate texts are unique", () => {
    const seen = new Set<string>();
    for (const candidate of CANDIDATES) {
      const key = normalizeText(candidate.text).toLowerCase();
      ensure(!seen.has(key), `duplicate candidate: ${candidate.text}`);
      seen.add(key);
    }
  });
  check("every score is finite", () => {
    for (const candidate of CANDIDATES) {
      ensure(Number.isFinite(scoreBreakdown(candidate).total), "non-finite score");
    }
  });
  check("selection is deterministic", () => {
    const first = pickBest(buildPool());
    const second = pickBest(buildPool());
    ensure(first !== null && second !== null, "empty pool");
    ensure(first?.text === second?.text, "selection changed between runs");
  });
  check("best candidate clears validation", () => {
    const best = pickBest(buildPool());
    ensure(best !== null, "empty pool");
    ensure(validateEntry(best?.text ?? "").ok, "best candidate invalid");
  });

  return failures;
}

function main(argv: string[]): void {
  if (argv.includes("--self-test")) {
    const failures = runSelfTests();
    if (failures.length > 0) {
      for (const failure of failures) console.error(`self-test failed: ${failure}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `self-test passed: ${CANDIDATES.length} candidates, ${buildPool().length} eligible`,
    );
    return;
  }

  const pool = buildPool();
  const chosen = pickBest(pool) ?? fallbackCandidate();
  const check = validateEntry(chosen.text);
  if (!check.ok) {
    throw new Error(`selected entry failed validation: ${check.reason}`);
  }

  const summary = scoreBreakdown(chosen).total;

  if (argv.includes("--dry-run")) {
    console.log(`dry run: ${chosen.text}`);
    console.log(
      `score ${summary} / ${charCount(chosen.text)} chars / ` +
        `${byteCount(chosen.text)} bytes about ${chosen.gadget} (${chosen.angle})`,
    );
    return;
  }

  writeEntry(chosen.text);

  const written = readFileSync(OUTPUT_PATH, "utf8");
  if (written !== chosen.text) {
    throw new Error("written entry did not read back byte for byte");
  }
  const writtenCheck = validateEntry(written);
  if (!writtenCheck.ok) {
    throw new Error(`written entry failed validation: ${writtenCheck.reason}`);
  }

  console.log(
    `wrote ${charCount(chosen.text)} chars / ${byteCount(chosen.text)} bytes ` +
      `(score ${summary}) about ${chosen.gadget} (${chosen.angle}) to ${OUTPUT_PATH}`,
  );
}

main(process.argv.slice(2));
