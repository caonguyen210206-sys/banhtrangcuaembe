# TutorFlow AI

Prototype web giao bài tập Toán tự động dành cho gia sư 1 kèm 1.

## Các luồng đã thiết kế

- Hồ sơ riêng cho từng học sinh.
- Tải tài liệu PDF hoặc Word của cả năm.
- AI phân tích tài liệu thành chương, bài, kỹ năng và dạng toán.
- Thiết lập bài tập theo độ khó, loại câu hỏi và lỗi sai của học sinh.
- AI tạo nội dung mới dựa trên kiến thức, không sao chép nguyên bài trong tài liệu.
- Gia sư xem đáp án, độ mới và duyệt trước khi giao.
- Học sinh làm bài, xin gợi ý và sửa câu sai.
- Báo cáo kết quả, lỗi lặp lại và đề xuất nội dung buổi học sau.

## Trạng thái

Đây là prototype front-end tĩnh. Dữ liệu AI, tài khoản, lưu trữ tài liệu và chấm bài phía máy chủ đang được mô phỏng bằng dữ liệu mẫu.

## Chạy cục bộ

Mở trực tiếp `index.html` hoặc chạy:

```bash
python -m http.server 8080
```

Sau đó truy cập `http://localhost:8080`.
