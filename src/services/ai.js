import { backendFetch } from './backend';
import { analyzeAnswerOffline, summarizeOffline } from './scoring';
import { hasApiKey } from './settings';

export function buildQuestionQueue(job) {
  const queue = [];
  (job.topics || []).forEach((topic) => {
    (topic.questions || []).forEach((q) => {
      queue.push({
        id: q.id,
        text: q.text,
        keywords: q.keywords || [],
        followUp: q.followUp || null,
        topicId: topic.id,
        topicName: topic.name,
        isFollowUp: false,
        followUpUsed: false,
      });
    });
  });
  return queue;
}

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promise(controller.signal).finally(() => clearTimeout(timer));
}

async function chatJson(settings, system, user, timeoutMs = 45000) {
  // Try backend first if available
  try {
    const data = await chatJsonBackend(system, user, timeoutMs);
    return data;
  } catch (e) {
    // fall through to direct call
  }
  return withTimeout(async (signal) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.chatModel || 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`chat-http-${res.status}`);
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('empty-chat-response');
    return JSON.parse(text);
  }, timeoutMs);
}

const INTERVIEWER_SYSTEM = (job) =>
  `You are InterviewAI, a professional and supportive hiring interviewer for the ${job.title} role at ${job.company}.
Speak like a real interviewer: concise, warm, professional.
You will be given the interview question and the candidate's spoken answer transcript.
Evaluate the answer for correctness, depth, structure and communication clarity.
Respond ONLY with JSON using exactly these keys:
{
  "score": <integer 0-100>,
  "passed": <boolean true if score >= 55>,
  "strengths": <array of short strings, max 3>,
  "gaps": <array of short strings, max 3>,
  "feedbackSpoken": <2-3 spoken sentences, friendly, includes the score>,
  "feedbackText": <one paragraph of detailed written feedback>,
  "askFollowUp": <boolean, true only if the answer was weak or vague and a short follow-up would help>,
  "followUpQuestion": <string, only when askFollowUp is true, else empty>,
  "followUpKeywords": <array of keywords for the follow-up question, else empty>
}`;

export function createEngine({ job, settings }) {
  const queue = buildQuestionQueue(job);
  let index = 0;
  const answers = [];

  function current() {
    return index < queue.length ? queue[index] : null;
  }

  function insertFollowUp(question, followUp) {
    const item = {
      id: `${question.id}-fu-${Date.now()}`,
      text: followUp.text,
      keywords: followUp.keywords || [],
      followUp: null,
      topicId: question.topicId,
      topicName: question.topicName,
      isFollowUp: true,
      followUpUsed: false,
    };
    queue.splice(index + 1, 0, item);
    return item;
  }

  async function evaluate(question, transcript, { segmentUri } = {}) {
    const text = (transcript || '').trim();
    let result = null;

    if (hasApiKey(settings) && text) {
      try {
        const data = await chatJson(
          settings,
          INTERVIEWER_SYSTEM(job),
          `Role: ${job.title}\nTopic: ${question.topicName}\nQuestion: ${question.text}\nCandidate answer transcript:\n"""${text.slice(0, 4000)}"""\nRespond with the JSON only.`
        );
        const score = Math.max(0, Math.min(100, Math.round(Number(data.score) || 0)));
        result = {
          score,
          passed: typeof data.passed === 'boolean' ? data.passed : score >= 55,
          strengths: Array.isArray(data.strengths) ? data.strengths.slice(0, 3).map(String) : [],
          gaps: Array.isArray(data.gaps) ? data.gaps.slice(0, 3).map(String) : [],
          feedbackSpoken: String(data.feedbackSpoken || '').slice(0, 400),
          feedbackText: String(data.feedbackText || '').slice(0, 800),
          askFollowUp: Boolean(data.askFollowUp),
          followUpQuestion: String(data.followUpQuestion || '').trim(),
          followUpKeywords: Array.isArray(data.followUpKeywords) ? data.followUpKeywords.slice(0, 8).map(String) : [],
          source: 'openai',
        };
        if (!result.feedbackSpoken) {
          result.feedbackSpoken = `You scored ${score} out of 100 for that answer.`;
        }
      } catch {
        result = null;
      }
    }

    if (!result) {
      result = { ...analyzeAnswerOffline(question, text), askFollowUp: false, followUpQuestion: '', followUpKeywords: [], source: 'offline' };
    }

    if (!question.isFollowUp && !question.followUpUsed && question.followUp && (result.score < 50 || result.askFollowUp)) {
      question.followUpUsed = true;
      insertFollowUp(question, {
        text: question.followUp.text,
        keywords: question.followUp.keywords || [],
      });
    } else if (result.askFollowUp && result.followUpQuestion && !question.followUpUsed) {
      question.followUpUsed = true;
      insertFollowUp(question, {
        text: result.followUpQuestion,
        keywords: result.followUpKeywords,
      });
    }

    const record = {
      qIndex: answers.length + 1,
      questionId: question.id,
      question: question.text,
      topic: question.topicName,
      topicId: question.topicId,
      isFollowUp: question.isFollowUp,
      transcript: text,
      segmentUri: segmentUri || null,
      askedAt: Date.now(),
      score: result.score,
      passed: Boolean(result.passed),
      strengths: result.strengths || [],
      gaps: result.gaps || [],
      feedbackSpoken: result.feedbackSpoken || '',
      feedbackText: result.feedbackText || '',
      source: result.source,
    };
    answers.push(record);

    index += 1;
    return { record, nextQuestion: current(), finished: index >= queue.length };
  }

  async function finish({ integrity } = {}) {
    const offline = summarizeOffline(answers);
    let summary = offline;

    if (hasApiKey(settings) && answers.length) {
      try {
        const lines = answers
          .map((a) => `Q: ${a.question}\nTopic: ${a.topic}\nScore: ${a.score}/100\nAnswer: ${a.transcript.slice(0, 500)}`)
          .join('\n\n');
        const data = await chatJson(
          settings,
          'You are InterviewAI summarizing a completed job interview. Respond ONLY with JSON: {"spokenSummary": "<max 4 spoken sentences, warm and clear>", "writtenSummary": "<detailed paragraph with strengths, gaps and a recommendation>", "recommendation": "<Proceed to next round | Hold for review | Not a fit>"}',
          `Role: ${job.title} at ${job.company}\n\n${lines}`,
          60000
        );
        summary = {
          ...offline,
          spokenSummary: String(data.spokenSummary || offline.spokenSummary).slice(0, 600),
          writtenSummary: String(data.writtenSummary || offline.writtenSummary).slice(0, 1600),
          recommendation: String(data.recommendation || '').slice(0, 120) || null,
          source: 'openai',
        };
      } catch {
        summary = { ...offline, source: 'offline' };
      }
    }

    const flagCount = integrity && integrity.flags ? integrity.flags.length : 0;
    if (flagCount > 0) {
      summary.writtenSummary += `\n\nIntegrity notes: ${flagCount} monitoring event(s) were recorded during the session (camera coverage, leaving frame, or app switching). Recruiter should review them.`;
    }
    return summary;
  }

  return {
    totalPlanned: queue.length,
    current,
    answered: () => answers.length,
    answers: () => answers.slice(),
    evaluate,
    finish,
  };
}

export async function chatJsonBackend(system, user, timeoutMs = 45000) {
  try {
    const res = await backendFetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, user }),
    });
    if (!res.ok) throw new Error(`backend-http-${res.status}`);
    return await res.json();
  } catch (e) {
    throw e;
  }
}
