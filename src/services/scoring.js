const FILLER_WORDS = ['um', 'uh', 'erm', 'hmm', 'basically', 'actually', 'literally', 'anyway', 'sorta', 'kinda'];

const STRUCTURE_MARKERS = [
  'first', 'second', 'third', 'then', 'because', 'so that', 'for example', 'instance',
  'after that', 'finally', 'result', 'learned', 'impact', 'trade-off', 'tradeoff', 'however',
];

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function stem(word) {
  return word
    .replace(/(ing|edly|ed|es|s)$/i, '')
    .replace(/(ization|isation|ment|ness|tion|sion)$/i, '');
}

function unique(list) {
  return Array.from(new Set(list));
}

function containsPhrase(haystack, phrase) {
  return haystack.includes(phrase);
}

export function analyzeAnswerOffline(question, answerText) {
  const text = (answerText || '').trim();
  const tokens = tokenize(text);
  const words = tokens.length;

  if (words < 5) {
    return {
      score: 10,
      passed: false,
      strengths: [],
      gaps: ['Answer was too short to evaluate'],
      feedbackSpoken: 'That answer was very short. Try to explain your reasoning with a concrete example next time.',
      feedbackText:
        'Your answer was under 5 words, so it did not demonstrate understanding. Aim for 40–120 words: explain the concept, give an example, and close with the impact or trade-off.',
      keywordHits: [],
      metrics: { words, keywordCoverage: 0, structure: 0, fillerRatio: 0, relevance: 0 },
    };
  }

  const lower = text.toLowerCase();
  const stems = new Set(tokens.map(stem));

  const keywordHits = (question.keywords || []).filter((kw) => containsPhrase(lower, kw) || stems.has(stem(kw.split(' ')[0])));
  const keywordCoverage = (question.keywords || []).length ? keywordHits.length / (question.keywords || []).length : 0;

  let lengthScore = 0;
  if (words >= 80 && words <= 180) lengthScore = 1;
  else if (words >= 45 && words <= 240) lengthScore = 0.75;
  else if (words >= 25) lengthScore = 0.45;
  else lengthScore = 0.2;

  const structureHits = STRUCTURE_MARKERS.filter((m) => lower.includes(m));
  const structureScore = Math.min(1, structureHits.length / 3);

  const fillerCount = tokens.filter((t) => FILLER_WORDS.includes(t)).length;
  const fillerRatio = fillerCount / words;

  const questionTokens = unique(tokenize(question.text).filter((t) => t.length > 3));
  const overlap = questionTokens.filter((t) => stems.has(stem(t)));
  const relevance = questionTokens.length ? Math.min(1, overlap.length / questionTokens.length + 0.35) : 0.5;

  const score = Math.round(
    Math.min(
      100,
      keywordCoverage * 45 + lengthScore * 22 + structureScore * 13 + relevance * 15 - Math.min(15, fillerRatio * 300)
    )
  );

  const strengths = [];
  const gaps = [];

  if (keywordCoverage >= 0.5) strengths.push(`Covered key concepts: ${keywordHits.slice(0, 5).join(', ')}`);
  else if (keywordHits.length) strengths.push(`Mentioned some relevant terms: ${keywordHits.join(', ')}`);
  else gaps.push('Did not touch the core concepts expected for this question');

  if (lengthScore >= 0.75) strengths.push('Answer had good depth and detail');
  else gaps.push(words < 45 ? 'Answer was brief — expand with examples' : 'Answer was longer than needed — keep it structured');

  if (structureScore >= 0.66) strengths.push('Well structured response with clear flow');
  else gaps.push('Use signposts like “first… because… for example” to structure the answer');

  if (fillerRatio > 0.06) gaps.push('Reduce filler words — pause instead of saying “um” or “uh”');

  if (score >= 65) {
    return {
      score,
      passed: true,
      strengths,
      gaps,
      feedbackSpoken: `Nice work. You scored ${score} out of 100 on that answer. ${strengths[0] || ''} ${gaps[0] ? 'One tip: ' + gaps[0] + '.' : ''}`,
      feedbackText: `Score: ${score}/100. ${strengths.join('. ')}.${gaps.length ? ' Areas to improve: ' + gaps.join('; ') + '.' : ''}`,
      keywordHits,
      metrics: { words, keywordCoverage, structureScore, fillerRatio, relevance },
    };
  }

  if (score >= 40) {
    return {
      score,
      passed: false,
      strengths,
      gaps,
      feedbackSpoken: `That was a decent attempt, scoring ${score} out of 100, but it needs more depth. ${gaps[0] || 'Add a concrete example.'}`,
      feedbackText: `Score: ${score}/100. Partially relevant answer. ${strengths.join('. ')} Improvements: ${gaps.join('; ')}.`,
      keywordHits,
      metrics: { words, keywordCoverage, structureScore, fillerRatio, relevance },
    };
  }

  return {
    score,
    passed: false,
    strengths,
    gaps,
    feedbackSpoken: `I could only score that ${score} out of 100. It missed the main points. Let's keep moving, and try to mention the key concepts with an example.`,
    feedbackText: `Score: ${score}/100. The answer was off-target for this question. Expected concepts included: ${(question.keywords || []).slice(0, 6).join(', ')}. Improvements: ${gaps.join('; ')}.`,
    keywordHits,
    metrics: { words, keywordCoverage, structureScore, fillerRatio, relevance },
  };
}

export function summarizeOffline(answers) {
  if (!answers || !answers.length) {
    return {
      overallScore: 0,
      spokenSummary: 'The interview finished without recorded answers.',
      writtenSummary: 'No answers were recorded for this session.',
      perTopic: {},
    };
  }

  const byTopic = {};
  answers.forEach((a) => {
    const key = a.topic || 'General';
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push(a.score || 0);
  });

  const perTopic = {};
  Object.keys(byTopic).forEach((k) => {
    const list = byTopic[k];
    perTopic[k] = Math.round(list.reduce((s, v) => s + v, 0) / list.length);
  });

  const overallScore = Math.round(answers.reduce((s, a) => s + (a.score || 0), 0) / answers.length);
  const best = answers.reduce((a, b) => (b.score > a.score ? b : a), answers[0]);
  const worst = answers.reduce((a, b) => (b.score < a.score ? b : a), answers[0]);

  const strongTopics = Object.keys(perTopic).filter((k) => perTopic[k] >= 65);
  const weakTopics = Object.keys(perTopic).filter((k) => perTopic[k] < 50);

  const spokenSummary = `You finished with an overall score of ${overallScore} out of 100. ${
    strongTopics.length ? 'Your strength was ' + strongTopics.join(', ') + '. ' : ''
  }${weakTopics.length ? 'Focus areas for improvement: ' + weakTopics.join(', ') + '.' : 'Solid consistency across topics.'} ${
    overallScore >= 65 ? 'Keep refining your examples and you will be interview ready.' : 'Review the weak topics and practice structured answers.'
  }`;

  const writtenSummary = [
    `Overall score: ${overallScore}/100 across ${answers.length} answers.`,
    strongTopics.length ? `Strongest topics: ${strongTopics.join(', ')}.` : '',
    weakTopics.length ? `Weakest topics: ${weakTopics.join(', ')}.` : '',
    best ? `Best answer: “${(best.question || '').slice(0, 90)}…” (${best.score}/100).` : '',
    worst ? `Needs most work: “${(worst.question || '').slice(0, 90)}…” (${worst.score}/100).` : '',
    'Recommendation: ' + (overallScore >= 75 ? 'Ready to progress to the next round.' : overallScore >= 55 ? 'Progress with targeted preparation on weak areas.' : 'More preparation advised before the next round.'),
  ]
    .filter(Boolean)
    .join('\n');

  return { overallScore, spokenSummary, writtenSummary, perTopic };
}
