export const JOBS = {
  'rn-dev-01': {
    id: 'rn-dev-01',
    title: 'React Native Developer',
    company: 'TechNova Labs',
    location: 'Bengaluru · Hybrid',
    experience: '2–4 years',
    description:
      'Build and ship cross-platform mobile features for a fintech product used by millions. You will work with React Native, TypeScript, native modules and CI delivery pipelines.',
    skills: ['React Native', 'JavaScript', 'React', 'Native APIs', 'Performance'],
    topics: [
      {
        id: 'rn-core',
        name: 'React Native fundamentals',
        questions: [
          {
            id: 'rn-q1',
            text: 'Tell me about your experience with React Native. Which apps have you built and what was your specific contribution?',
            keywords: ['react native', 'app', 'android', 'ios', 'component', 'navigation', 'state', 'api', 'released', 'play store', 'app store', 'project', 'team'],
            followUp: {
              id: 'rn-q1-f',
              text: 'You mentioned your app work. What was the hardest production bug you faced in it, and how did you fix it?',
              keywords: ['bug', 'crash', 'debug', 'logs', 'fix', 'root cause', ' reproduced', 'memory', 'navigation', 'state', 'native'],
            },
          },
          {
            id: 'rn-q2',
            text: 'How does the bridge (or bridgeless architecture and JSI) work in React Native, and why does it matter for performance?',
            keywords: ['bridge', 'jsi', 'native modules', 'async', 'serial', 'json', 'thread', 'javascript', 'native', 'performance', 'hermes', 'turbomodule', 'fabric'],
            followUp: null,
          },
        ],
      },
      {
        id: 'rn-perf',
        name: 'Performance & debugging',
        questions: [
          {
            id: 'rn-q3',
            text: 'A list screen feels laggy and drops frames while scrolling. How would you find the bottleneck and fix it?',
            keywords: ['flatlist', 're-render', 'memo', 'usecallback', 'usememo', 'virtualization', 'render', 'profiler', 'devtools', 'image', 'optimization', 'itemsize', 'windowsize', ' PureComponent'],
            followUp: {
              id: 'rn-q3-f',
              text: 'Suppose memoization did not help. What tooling would you use next to prove where the time is going?',
              keywords: ['perf monitor', 'systrace', 'android studio', 'xcode', 'instruments', 'js profiler', 'hermes', 'timeline', 'cpu', 'gpu'],
            },
          },
          {
            id: 'rn-q4',
            text: 'How do you handle state management in a medium-to-large React Native app? Compare the options you have used.',
            keywords: ['redux', 'zustand', 'context', 'reducer', 'mobx', 'jotai', 'query', 'hook', 'store', 'global', 'local', 'immutable', 'devtools'],
            followUp: null,
          },
        ],
      },
      {
        id: 'rn-native',
        name: 'Native modules & device APIs',
        questions: [
          {
            id: 'rn-q5',
            text: 'Walk me through how you would add a native module for a device feature that has no existing library.',
            keywords: ['native module', 'swift', 'kotlin', 'java', 'objective-c', 'turbomodule', 'codegen', 'sdk', 'ios', 'android', 'bridge', 'api', 'config plugin'],
            followUp: null,
          },
          {
            id: 'rn-q6',
            text: 'How do permissions, deep linking and app lifecycle events differ between iOS and Android in React Native?',
            keywords: ['permission', 'ios', 'android', 'manifest', 'info.plist', 'deep link', 'linking', 'lifecycle', 'appstate', 'background', 'foreground', 'interrupt'],
            followUp: null,
          },
        ],
      },
      {
        id: 'rn-quality',
        name: 'Quality, testing & delivery',
        questions: [
          {
            id: 'rn-q7',
            text: 'How do you test a React Native application? Describe the testing pyramid you follow in practice.',
            keywords: ['unit', 'jest', 'integration', 'detox', 'e2e', 'testing library', 'snapshot', 'ci', 'coverage', 'mock', 'component test'],
            followUp: null,
          },
          {
            id: 'rn-q8',
            text: 'How would you ship an over-the-air update safely without breaking production users?',
            keywords: ['ota', 'expo update', 'codepush', 'rollback', 'staged rollout', 'release channel', 'version', 'compatibility', 'migration', 'feature flag', 'monitoring'],
            followUp: null,
          },
        ],
      },
    ],
  },
  'fullstack-01': {
    id: 'fullstack-01',
    title: 'Full Stack JavaScript Developer',
    company: 'Orbit Commerce',
    location: 'Remote · India',
    experience: '3–5 years',
    description:
      'Own features end to end across a React web client and a Node.js services layer powering a commerce platform (catalog, cart, checkout, payments).',
    skills: ['React', 'Node.js', 'REST', 'Databases', 'System design'],
    topics: [
      {
        id: 'fs-language',
        name: 'JavaScript & React',
        questions: [
          {
            id: 'fs-q1',
            text: 'Explain the event loop in JavaScript, including the difference between microtasks and macrotasks, with examples.',
            keywords: ['event loop', 'microtask', 'macrotask', 'promise', 'queue', 'call stack', 'settimeout', 'await', 'async', 'single thread', 'task'],
            followUp: {
              id: 'fs-q1-f',
              text: 'Where can a long-running synchronous task actually block rendering or server responses in a real app?',
              keywords: ['blocking', 'main thread', 'render', 'request', 'worker', 'heavy', 'compute', 'latency'],
            },
          },
          {
            id: 'fs-q2',
            text: 'What are closures and higher-order functions? Give a practical example from code you have written.',
            keywords: ['closure', 'scope', 'higher-order', 'callback', 'function', 'variable', 'encapsulation', 'memoize', 'counter', 'private'],
            followUp: null,
          },
        ],
      },
      {
        id: 'fs-backend',
        name: 'Node.js & APIs',
        questions: [
          {
            id: 'fs-q3',
            text: 'How do you design a REST API for a checkout flow? Cover idempotency and error handling.',
            keywords: ['rest', 'endpoint', 'idempotent', 'idempotency key', 'http status', 'error', 'validation', 'schema', 'post', 'cart', 'payment', 'transaction'],
            followUp: {
              id: 'fs-q3-f',
              text: 'A payment provider times out after charging the customer. How does your API behave and what do you return to the client?',
              keywords: ['timeout', 'retry', 'webhook', 'reconcile', 'state', 'pending', 'unknown', 'queue', 'idempotent', 'refund'],
            },
          },
          {
            id: 'fs-q4',
            text: 'Compare SQL and NoSQL for a commerce catalog. Which would you pick for products, and which for orders? Why?',
            keywords: ['sql', 'nosql', 'postgres', 'mongodb', 'relational', 'document', 'index', 'transaction', 'acid', 'schema', 'join', 'scale', 'consistency'],
            followUp: null,
          },
        ],
      },
      {
        id: 'fs-system',
        name: 'System design',
        questions: [
          {
            id: 'fs-q5',
            text: 'Design a URL shortener service. Walk through the API, storage, scaling and caching decisions.',
            keywords: ['hash', 'base62', 'database', 'cache', 'redis', 'redirect', 'scale', 'replication', 'collision', 'rate limit', 'cdn', '301', '302'],
            followUp: null,
          },
          {
            id: 'fs-q6',
            text: 'How would you implement rate limiting for a public API? Compare the algorithms you know.',
            keywords: ['token bucket', 'leaky bucket', 'sliding window', 'counter', 'redis', 'distributed', 'limit', 'quota', 'throttle', 'middleware'],
            followUp: null,
          },
        ],
      },
      {
        id: 'fs-devops',
        name: 'Delivery & observability',
        questions: [
          {
            id: 'fs-q7',
            text: 'What does your CI/CD pipeline look like for a full stack service? What gates must a change pass before production?',
            keywords: ['ci', 'cd', 'pipeline', 'test', 'lint', 'build', 'deploy', 'staging', 'rollback', 'review', 'artifact', 'docker', 'canary'],
            followUp: null,
          },
          {
            id: 'fs-q8',
            text: 'How do you monitor a production service? What metrics, logs and alerts would you set up on day one?',
            keywords: ['metrics', 'logs', 'alert', 'latency', 'error rate', 'traffic', 'slo', 'grafana', 'datadog', 'prometheus', 'tracing', 'dashboard', 'p95'],
            followUp: null,
          },
        ],
      },
    ],
  },
  'data-analyst-01': {
    id: 'data-analyst-01',
    title: 'Data Analyst',
    company: 'Finlytics Analytics',
    location: 'Mumbai · On-site',
    experience: '1–3 years',
    description:
      'Turn raw business data into decisions. You will build dashboards, run experiments, and partner with product and finance teams on forecasting.',
    skills: ['SQL', 'Python', 'Statistics', 'Dashboards', 'Storytelling'],
    topics: [
      {
        id: 'da-sql',
        name: 'SQL & data handling',
        questions: [
          {
            id: 'da-q1',
            text: 'How would you find the top five products by revenue per month, including products with zero sales? Walk through the query logic.',
            keywords: ['join', 'left join', 'group by', 'sum', 'coalesce', 'window function', 'rank', 'date_trunc', 'month', 'null', 'calendar', 'cte'],
            followUp: {
              id: 'da-q1-f',
              text: 'That query is slow on a large table. How would you diagnose and speed it up?',
              keywords: ['index', 'partition', 'explain', 'scan', 'aggregate', 'materialized', 'precompute', 'cache', 'query plan'],
            },
          },
          {
            id: 'da-q2',
            text: 'Explain the difference between INNER, LEFT and FULL OUTER joins, and when you would use a window function instead of GROUP BY.',
            keywords: ['inner', 'left', 'full outer', 'join', 'window function', 'row_number', 'rank', 'partition by', 'aggregate', 'group by', 'running total'],
            followUp: null,
          },
        ],
      },
      {
        id: 'da-stats',
        name: 'Statistics & experiments',
        questions: [
          {
            id: 'da-q3',
            text: 'How do you design and read an A/B test? What mistakes cause teams to reach wrong conclusions?',
            keywords: ['hypothesis', 'control', 'variant', 'sample size', 'power', 'significance', 'p-value', 'confidence', 'guardrail', 'novelty', 'peers', 'randomization'],
            followUp: {
              id: 'da-q3-f',
              text: 'The test looks significant but revenue did not move. What do you check next?',
              keywords: ['segment', 'sample ratio mismatch', 'instrumentation', 'metric definition', 'cannibalization', 'long term', 'variance', 'outlier'],
            },
          },
          {
            id: 'da-q4',
            text: 'Explain the difference between correlation and causation, with a business example where confusing them costs money.',
            keywords: ['correlation', 'causation', 'confounder', 'experiment', 'observation', 'spurious', 'ice cream', 'sales', 'bias', 'control'],
            followUp: null,
          },
        ],
      },
      {
        id: 'da-python',
        name: 'Python & pipelines',
        questions: [
          {
            id: 'da-q5',
            text: 'How do you clean a messy dataset in pandas? Describe the checks you run before any analysis.',
            keywords: ['pandas', 'null', 'missing', 'duplicate', 'dtype', 'outlier', 'merge', 'validate', 'describe', 'isna', 'astype', 'clean'],
            followUp: null,
          },
          {
            id: 'da-q6',
            text: 'How would you automate a weekly reporting pipeline that finance depends on?',
            keywords: ['schedule', 'cron', 'airflow', 'dbt', 'script', 'email', 'slack', 'alert', 'idempotent', 'retry', 'validation', 'test'],
            followUp: null,
          },
        ],
      },
      {
        id: 'da-communication',
        name: 'Insights & storytelling',
        questions: [
          {
            id: 'da-q7',
            text: 'You find that a key metric dropped 12 percent last week. How do you investigate and communicate the finding?',
            keywords: ['segment', 'dimension', 'baseline', 'seasonality', 'funnel', 'root cause', 'stakeholder', 'summary', 'chart', 'dashboard', 'impact', 'compare'],
            followUp: null,
          },
          {
            id: 'da-q8',
            text: 'How do you choose between a table, a line chart and a bar chart? What makes a dashboard exec-ready?',
            keywords: ['chart', 'trend', 'comparison', 'distribution', 'table', 'kpi', 'story', 'clarity', 'actionable', 'title', 'annotation', 'filter'],
            followUp: null,
          },
        ],
      },
    ],
  },
};

export const INTRO_QUESTIONS = [
  { id: 'intro-1', text: 'Welcome to your interview. Before we begin, please introduce yourself and briefly tell me about the role you are applying for.' },
];

export function getJob(jobId) {
  return JOBS[jobId] || null;
}

export function countQuestions(job) {
  if (!job) return 0;
  return job.topics.reduce((n, t) => n + t.questions.length, 0);
}
