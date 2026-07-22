import express from 'express';
import cors from 'cors';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 10000);
const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
const maxFileMb = Number(process.env.MAX_FILE_MB || 25);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is not configured. AI endpoints will return 503.');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileMb * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const supported = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]);
    const accepted = supported.has(file.mimetype);
    callback(accepted ? null : new Error('Chỉ hỗ trợ PDF, DOC và DOCX.'), accepted);
  }
});

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin không được phép.'));
  }
}));
app.use(express.json({ limit: '1mb' }));

const rateBuckets = new Map();
app.use('/api', (req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > 60_000) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > 30) return res.status(429).json({ error: 'Bạn thao tác quá nhanh. Hãy thử lại sau một phút.' });
  next();
});

function requireOpenAI(_req, res, next) {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Backend chưa được cấu hình OPENAI_API_KEY.' });
  next();
}

const documentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'grade', 'summary', 'chapters'],
  properties: {
    title: { type: 'string' },
    grade: { type: 'string' },
    summary: { type: 'string' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'topics'],
        properties: {
          title: { type: 'string' },
          topics: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'skills', 'methods', 'common_errors'],
              properties: {
                title: { type: 'string' },
                skills: { type: 'array', items: { type: 'string' } },
                methods: { type: 'array', items: { type: 'string' } },
                common_errors: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }
};

const exerciseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'questions'],
  properties: {
    title: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'difficulty', 'skill', 'prompt', 'answer', 'solution', 'common_error', 'source_reference', 'novelty_note'],
        properties: {
          type: { type: 'string', enum: ['Trắc nghiệm', 'Điền đáp án', 'Tự luận ngắn', 'Tìm lỗi sai', 'Sắp xếp bước giải'] },
          difficulty: { type: 'string', enum: ['Cơ bản', 'Trung bình', 'Vận dụng'] },
          skill: { type: 'string' },
          prompt: { type: 'string' },
          answer: { type: 'string' },
          solution: { type: 'array', items: { type: 'string' } },
          common_error: { type: 'string' },
          source_reference: { type: 'string' },
          novelty_note: { type: 'string' }
        }
      }
    }
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY), model });
});

app.post('/api/documents', requireOpenAI, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chưa nhận được file.' });

    const uploaded = await openai.files.create({
      file: await toFile(req.file.buffer, req.file.originalname, { type: req.file.mimetype }),
      purpose: 'user_data',
      expires_after: { anchor: 'created_at', seconds: 604800 }
    });

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: 'developer',
          content: [{
            type: 'input_text',
            text: 'Bạn là chuyên gia thiết kế chương trình Toán phổ thông. Phân tích tài liệu thành cấu trúc kiến thức ngắn gọn, chính xác. Không sao chép dài dòng nội dung gốc.'
          }]
        },
        {
          role: 'user',
          content: [
            { type: 'input_file', file_id: uploaded.id },
            {
              type: 'input_text',
              text: 'Hãy xác định tên tài liệu, khối lớp, tóm tắt và các chương/bài chính. Với mỗi bài, nêu kỹ năng, phương pháp giải và lỗi thường gặp. Chỉ trả về dữ liệu theo schema.'
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'math_document_analysis',
          strict: true,
          schema: documentSchema
        }
      }
    });

    const analysis = JSON.parse(response.output_text);
    res.json({
      fileId: uploaded.id,
      filename: req.file.originalname,
      size: req.file.size,
      analysis
    });
  } catch (error) {
    console.error('Document analysis failed:', error);
    res.status(500).json({ error: error?.message || 'Không thể phân tích tài liệu.' });
  }
});

app.post('/api/generate', requireOpenAI, async (req, res) => {
  try {
    const {
      fileId,
      topic,
      count = 10,
      grade = '',
      modes = [],
      constraints = '',
      studentContext = ''
    } = req.body || {};

    if (!fileId || !topic) return res.status(400).json({ error: 'Thiếu fileId hoặc chủ đề.' });
    const safeCount = Math.max(3, Math.min(20, Number(count) || 10));

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: 'developer',
          content: [{
            type: 'input_text',
            text: [
              'Bạn là giáo viên Toán tạo bài tập về nhà cho hình thức gia sư 1 kèm 1.',
              'Tạo câu hỏi mới dựa trên kiến thức và phương pháp trong tài liệu, tuyệt đối không sao chép nguyên câu hoặc chỉ thay số.',
              'Mỗi câu phải có đáp án đúng, lời giải từng bước, lỗi thường gặp và tham chiếu phần kiến thức.',
              'Không sử dụng kiến thức vượt quá phạm vi tài liệu hoặc yêu cầu.'
            ].join(' ')
          }]
        },
        {
          role: 'user',
          content: [
            { type: 'input_file', file_id: fileId },
            {
              type: 'input_text',
              text: [
                `Tạo đúng ${safeCount} câu cho chủ đề: ${topic}.`,
                grade ? `Khối/lớp: ${grade}.` : '',
                modes.length ? `Cách tạo: ${modes.join(', ')}.` : '',
                constraints ? `Giới hạn bổ sung: ${constraints}.` : '',
                studentContext ? `Bối cảnh học sinh: ${studentContext}.` : '',
                'Phân bổ độ khó hợp lý: khoảng 40% cơ bản, 40% trung bình, 20% vận dụng.',
                'Đảm bảo các câu khác nhau về cấu trúc, cách hỏi hoặc ngữ cảnh.'
              ].filter(Boolean).join('\n')
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'math_exercise_set',
          strict: true,
          schema: exerciseSchema
        }
      }
    });

    const draft = JSON.parse(response.output_text);
    if (!Array.isArray(draft.questions) || draft.questions.length === 0) {
      throw new Error('AI không trả về danh sách câu hỏi hợp lệ.');
    }

    res.json(draft);
  } catch (error) {
    console.error('Exercise generation failed:', error);
    res.status(500).json({ error: error?.message || 'Không thể tạo bài tập.' });
  }
});

app.delete('/api/documents/:fileId', requireOpenAI, async (req, res) => {
  try {
    await openai.files.del(req.params.fileId);
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Không thể xóa tài liệu.' });
  }
});

for (const file of ['index.html', 'styles.css', 'ai.css', 'app.js']) {
  app.get(`/${file}`, (_req, res) => res.sendFile(path.join(__dirname, file)));
}
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use((error, _req, res, _next) => {
  const message = error?.message || 'Yêu cầu không hợp lệ.';
  res.status(message.includes('File too large') ? 413 : 400).json({ error: message });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`TutorFlow AI listening on port ${port}`);
});
