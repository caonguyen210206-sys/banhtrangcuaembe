# TutorFlow AI

Web giao bài tập Toán tự động dành cho gia sư 1 kèm 1, có backend kết nối OpenAI để đọc tài liệu và tạo câu hỏi thật.

## Workflow

1. Thêm hồ sơ học sinh.
2. Tải PDF, DOC hoặc DOCX lên backend.
3. Backend tải file lên OpenAI và phân tích chương, bài, kỹ năng, phương pháp, lỗi thường gặp.
4. Chọn học sinh, tài liệu, chủ đề, số câu và hạn nộp.
5. OpenAI tạo câu hỏi mới có đáp án, lời giải, lỗi thường gặp và nguồn tham chiếu.
6. Gia sư kiểm tra bản nháp rồi giao bài.

## Kiến trúc

- `index.html`, `styles.css`, `ai.css`, `app.js`: giao diện web.
- `server.js`: Express backend giữ API key và gọi OpenAI Responses API.
- `render.yaml`: cấu hình triển khai backend và toàn bộ web trên Render.
- `.env.example`: danh sách biến môi trường cần thiết.

API key không được đặt trong frontend hoặc commit lên GitHub. OpenAI khuyến nghị lưu API key trong biến môi trường của server.

## Chạy cục bộ

Yêu cầu Node.js 20 trở lên.

```bash
npm install
cp .env.example .env
```

Đặt `OPENAI_API_KEY` trong môi trường rồi chạy:

```bash
npm start
```

Truy cập `http://localhost:10000`.

## Triển khai backend bằng Render

Repository có sẵn `render.yaml` theo chuẩn Render Blueprint.

1. Tạo Blueprint hoặc Web Service từ repository này.
2. Render sử dụng `npm install` và `npm start`.
3. Nhập bí mật `OPENAI_API_KEY` khi Render yêu cầu.
4. Sau khi deploy, mở URL `onrender.com` để dùng trực tiếp.
5. Để tiếp tục dùng bản GitHub Pages, bấm **Chưa kết nối AI** trên giao diện và nhập URL Render.

Các biến môi trường:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
ALLOWED_ORIGINS=https://caonguyen210206-sys.github.io
MAX_FILE_MB=25
PORT=10000
```

## API

### `GET /api/health`

Kiểm tra backend và trạng thái cấu hình AI.

### `POST /api/documents`

Nhận multipart field `file`, upload lên OpenAI và trả về cấu trúc tài liệu.

### `POST /api/generate`

Nhận cấu hình bài tập và trả về danh sách câu hỏi có cấu trúc.

### `DELETE /api/documents/:fileId`

Xóa file khỏi OpenAI.

## Lưu ý

- File được upload với mục đích `user_data` và cấu hình hết hạn sau 7 ngày.
- Backend giới hạn file mặc định 25 MB và tối đa 30 yêu cầu/phút cho mỗi IP.
- Dữ liệu học sinh và bài tập hiện vẫn lưu bằng `localStorage`; cần thêm cơ sở dữ liệu và đăng nhập trước khi dùng chính thức cho nhiều thiết bị.
