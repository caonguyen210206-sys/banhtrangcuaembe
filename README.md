# TutorFlow AI

Prototype web giao bài tập Toán tự động dành cho gia sư 1 kèm 1.

## Workflow chính

1. Thêm hồ sơ học sinh.
2. Tải tài liệu PDF hoặc Word làm nguồn kiến thức.
3. Chọn học sinh, tài liệu, chủ đề, số câu và thời hạn.
4. AI chuẩn bị bản nháp, kiểm tra độ khó và độ trùng lặp.
5. Gia sư duyệt nội dung trong cùng một quy trình.
6. Xác nhận và giao bài.
7. Kết quả chỉ được hiển thị sau khi học sinh nộp bài.

## Nguyên tắc giao diện

- Không có dữ liệu học sinh, tài liệu, điểm số hoặc báo cáo được điền sẵn.
- Giao diện sử dụng empty state cho tài khoản mới.
- Dữ liệu được tạo từ thao tác của người dùng và lưu cục bộ bằng `localStorage`.
- Quy trình tạo, duyệt và giao bài được hợp nhất trong một màn hình bốn bước.
- AI sử dụng tài liệu làm nguồn kiến thức, không sao chép nguyên câu hỏi.

## Trạng thái prototype

Đây là prototype front-end tĩnh. Chức năng đọc nội dung file, tạo câu hỏi bằng AI, đăng nhập, cơ sở dữ liệu và chấm bài phía máy chủ chưa được kết nối.

## Chạy cục bộ

Mở trực tiếp `index.html` hoặc chạy:

```bash
python -m http.server 8080
```

Sau đó truy cập `http://localhost:8080`.
