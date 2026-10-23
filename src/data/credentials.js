const CREDENTIALS = [
  {
    username: 'candidate1',
    password: 'Interview@123',
    jobId: 'rn-dev-01',
    candidateName: 'Aarav Sharma',
    email: 'aarav.sharma@mail.com',
  },
  {
    username: 'candidate2',
    password: 'Interview@123',
    jobId: 'fullstack-01',
    candidateName: 'Diya Patel',
    email: 'diya.patel@mail.com',
  },
  {
    username: 'candidate3',
    password: 'Interview@123',
    jobId: 'data-analyst-01',
    candidateName: 'Rohan Mehta',
    email: 'rohan.mehta@mail.com',
  },
];

export function verifyCredentials(username, password) {
  const u = (username || '').trim().toLowerCase();
  const p = password || '';
  if (!u || !p) return { ok: false, error: 'Enter the username and password provided by your recruiter.' };
  const match = CREDENTIALS.find((c) => c.username.toLowerCase() === u && c.password === p);
  if (!match) return { ok: false, error: 'Invalid credentials. Check with your recruiter for the correct username and password.' };
  return { ok: true, credential: match };
}

export const DEMO_HINT = 'Demo credentials: candidate1 / Interview@123';
