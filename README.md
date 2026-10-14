# CartLens

Java 21/Spring Boot và React/TypeScript để khai phá FWUP trên luồng giao dịch. **FWUDS-CT và FWUDS-DWT luôn chạy song song** trên cùng pane, cửa sổ và minWUS; cấu trúc và kết quả được lưu riêng.

## Chạy ứng dụng

Yêu cầu JDK 21+, Node.js 22+, Corepack. Backend dùng H2 embedded, không cần database server riêng.

```powershell
cd backend
.\mvnw.cmd verify
.\mvnw.cmd spring-boot:run
```

Trong terminal khác:

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Hoặc chạy `run.bat` sau khi build backend. Backend mặc định http://localhost:8080; frontend http://localhost:5173. Khởi động lại backend cũ để tải mã mới. Đóng backend trước khi đóng gói lại JAR đang bị Windows khóa.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| VITE_API_BASE_URL | http://localhost:8080/api/v1 | API frontend |
| CARTLENS_CORS_ALLOWED_ORIGIN | http://localhost:5173 | Origin frontend |
| CARTLENS_ARCHIVE_PATH | ./data/cartlens | H2 archive theo working directory backend |
| CARTLENS_DATASET_ROOT | Tự tìm root/parent dự án | Thư mục cha chứa Retail-metadata và Accidents-metadata |

Mỗi nguồn cần `transactions.txt` và `investment_table.txt`. Dạng file `item IDs:total utility:per-item utilities`. Parser kiểm tra metadata, utility âm, tổng utility và item trùng. Dữ liệu giữ utility của file bằng quantity=1, weight=item utility; total investment chỉ xác nhận metadata.

## Trực quan hóa

- **Giao dịch:** chọn Retail (sparse) / Accidents (dense), nạp luồng hoặc DSe để thử nhanh.
- **Cấu hình luồng:** pane size, số pane/window, minWUS, tốc độ và giới hạn giao dịch dùng chung. Không cần chọn thuật toán. Tốc độ/giới hạn bằng 0 là chạy tối đa/đọc toàn file.
- **FWUDS-CT:** CTset thật, thứ tự vòng lcTid, ΣTWU, giao tập minh họa và mẫu đạt minWUS, tiến độ pane/cửa sổ.
- **FWUDS-DWT:** cây DSWUN thật, nút pre/post, nhánh tương tác, TAILLIST, mã WUNList xem trước và kết quả, tiến độ pane/cửa sổ.
- **So sánh:** thời gian thực thi, bộ nhớ và thời gian cập nhật trên cùng window; tự đối chiếu CT/DWT sau mỗi pane.

Hai tab thuật toán chia chiều cao viewport cho cấu trúc và kết quả, phân trang theo chiều cao màn hình để không cuộn trang. Không cắt tập mẫu khai phá. Snapshot cập nhật mỗi 500 ms kể cả khi đang ở tab khác. Cấu trúc xem trước tối đa 32 CTset / 64 nút cây, UI ghi rõ phần rút gọn. Biểu đồ hiển thị 120 window gần nhất; toàn bộ telemetry được lưu H2 và giữ nguyên khi restart.

Tạm dừng và chờ **Đã tạm dừng** trước khi sửa cấu hình. **CONTINUE** giữ checkpoint. Đổi bộ dữ liệu cần **RESTART** tạo stream mới để tránh trộn nguồn; giữ nguyên stream cũ. Backend restart không tự chạy replay: bấm **Tiếp tục** để khôi phục. Đọc tới EOF chuyển **Hoàn tất**.

## Phép đo và giới hạn

Tham chiếu [bài báo](docs/specs/DeTaiJavaNangCao.pdf), §6.2–6.4. Thời gian đo riêng update/mining bằng nanoTime, không gồm đọc/ghi dữ liệu. Bộ nhớ giữ lại là **ước tính** object graph từng session + kết quả; có lựa chọn lượng cấp phát thật theo thread. Đây không phải peak heap đơn luồng trong paper. Số đo là phiên song song Java trên máy hiện tại, không tái tạo benchmark C# đơn luồng của bài báo.

Window web tối đa 100.000 giao dịch; minWUS=0 hỗ trợ tối đa 16 item/window. Budget mặc định 100.000 mẫu và 1.000.000 transaction-ID references/window. Accidents với minWUS rất thấp có thể vượt budget; lỗi được báo rõ, không trả tập mẫu bị cắt như kết quả hoàn chỉnh. Oracle kiểm chứng window nhỏ (≤16 item, ≤500 giao dịch).

## Kiểm thử

```powershell
cd backend
.\mvnw.cmd verify
cd ..\frontend
corepack pnpm build
corepack pnpm exec playwright install chromium --only-shell
corepack pnpm test:e2e
```

E2E mặc định dùng backend riêng 8081, archive riêng và frontend 5174. Đổi bằng `CARTLENS_E2E_API`/`CARTLENS_E2E_URL`. Không chạy E2E trên archive chứa dữ liệu quan trọng. Nếu JAR đang bị khóa, kiểm tra bằng `-Dspring-boot.repackage.skip=true`, rồi đóng gói bình thường khi dừng process đang dùng JAR.

Chi tiết kiến trúc và kiểm chứng: [FWUDS_PARALLEL_VISUALIZATION](docs/reviews/FWUDS_PARALLEL_VISUALIZATION.md).

## API

Prefix `/api/v1`. API mới: GET `/datasets/{retail,accidents}` và GET `/streams/{id}/live` (snapshot chung, cấu trúc và telemetry). Replay request lưu `dataset` = RETAIL/ACCIDENTS cùng checkpoint, mặc định RETAIL nếu thiếu.

```json
{"dataset":"RETAIL","algorithm":"FWUDS_DWT","paneSize":100,"windowPaneCount":4,"minWus":0.05,"transactionsPerSecond":100,"maxTransactions":1000,"weightMode":"PROVIDED_UTILITY","weightBatchSize":10000,"seed":42}
```

Trường algorithm giữ tương thích API/lịch sử chính; cả CT và DWT vẫn chạy. Các endpoint streams, overview, transactions, configuration, runs, results, comparisons, replay controls, CSV export và health cũ vẫn được hỗ trợ. `/results/window` nhận sessionId/windowId/patternAfter/limit để đọc đầy đủ mẫu theo trang; `/results/export.csv?sessionId=...` xuất toàn phiên của một thuật toán.
