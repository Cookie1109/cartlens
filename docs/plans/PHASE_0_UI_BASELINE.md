# Phase 0 - UI baseline

Tài liệu này chốt hành vi của Figma export trước khi frontend được refactor và nối với Java backend. Source baseline được giữ nguyên trong `frontend/src/App.tsx`; Phase 0 chỉ loại bỏ phần Vite/Figma scaffold bị thiếu dependency, không thay đổi component hoặc class giao diện.

## Năm màn hình

| Màn hình | Nội dung chính | Tương tác hiện có |
|---|---|---|
| Tổng quan | Trạng thái stream, số giao dịch/pane, sliding window và lần chạy gần nhất | Đi tới thêm giao dịch, khai phá hoặc kết quả |
| Giao dịch | Bảng giao dịch phân trang và tổng TWU | Thêm giao dịch qua side panel; validate ID, item, quantity, weight; reset toàn bộ stream |
| Khai phá mẫu | Chọn FWUDS-CT/FWUDS-DWT, `paneSize`, số pane và `minWUS`; xem trước window | Chạy mô phỏng, reset cấu hình và chuyển tới kết quả |
| Kết quả khai phá | Metadata run và bảng FWUP | Tìm kiếm, lọc độ dài, sắp xếp và mở panel chi tiết pattern |
| So sánh thuật toán | Thống kê hai algorithm và bảng sai lệch WUS | Chạy cả hai algorithm cùng config và xem trạng thái tương đương |

## State baseline

| State | Biểu hiện trong UI |
|---|---|
| Empty | Tổng quan không có dữ liệu; danh sách giao dịch trống; chưa có kết quả; chưa đủ kết quả so sánh |
| Loading | Banner/spinner khi đang chạy một algorithm hoặc chạy so sánh |
| Success | Banner hoàn tất ở trang khai phá; badge hoàn tất và bảng pattern ở kết quả; trạng thái trùng khớp ở so sánh |
| Error | Validation inline cho form giao dịch/config; banner lỗi khi chạy với window không có giao dịch; highlight sai lệch khi comparison không khớp |

## User flow hiện có

1. Ứng dụng mở ở **Tổng quan** với 40 giao dịch seed và kết quả mô phỏng gần nhất.
2. Người dùng vào **Giao dịch** để xem, thêm transaction hoặc xóa toàn bộ stream.
3. Người dùng vào **Khai phá mẫu**, chọn algorithm và cấu hình sliding window/MinWUS.
4. Khi bấm **Chạy khai phá**, UI chuyển `idle -> running -> success`; nếu window rỗng thì chuyển sang `error`.
5. Người dùng mở **Kết quả khai phá** để lọc và xem chi tiết FWUP.
6. Người dùng mở **So sánh thuật toán**; nếu config hiện tại chưa có đủ hai run thì có thể chạy cả hai, sau đó xem bảng đối chiếu.

## Ghi nhận baseline build

- Lần build đầu tiên của Figma export không thể khởi động vì `vite.config.ts` import `.figma/make/site.json`, trong khi artifact được bàn giao không chứa thư mục `.figma`.
- Không có story file hoặc asset Figma runtime nào trong source. Các plugin phục vụ Figma Make preview vì vậy không thuộc runtime UI và đã được bỏ khỏi Vite config.
- `index.html` được thay các placeholder Figma bằng metadata tĩnh của CartLens.
- `src/App.tsx`, `src/index.css`, entrypoint và dependency UI được giữ nguyên để bảo toàn visual baseline.
