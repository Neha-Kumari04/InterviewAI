import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ dest: '/tmp/interviewai-uploads/' });

if (!fs.existsSync('/tmp/interviewai-uploads/')) {
  fs.mkdirSync('/tmp/interviewai-uploads/', { recursive: true });
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', hasApiKey: !!process.env.OPENAI_API_KEY });
});

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!openai) {
      return res.status(400).json({ error: 'No OpenAI API key configured on server' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: req.body.model || 'whisper-1',
    });
    fs.unlinkSync(req.file.path);
    res.json({ text: transcript.text });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!openai) {
      return res.status(400).json({ error: 'No OpenAI API key configured on server' });
    }
    const { messages, model = 'gpt-4o-mini', temperature = 0.4, response_format } = req.body;
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      response_format,
    });
    res.json(completion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    if (!openai) {
      return res.status(400).json({ error: 'No OpenAI API key configured on server' });
    }
    const { system, user, model = 'gpt-4o-mini', temperature = 0.4 } = req.body;
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      response_format: { type: 'json_object' },
    });
    const text = completion.choices[0]?.message?.content;
    res.json(JSON.parse(text));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`InterviewAI backend running on port ${port}`);
});
