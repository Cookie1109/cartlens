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
- **FWUDS-DWT:** cây DSWUN đầy đủ, nút pre/post, phóng to/thu nhỏ và kéo để di chuyển, TAILLIST, mã WUNList xem trước và kết quả, tiến độ pane/cửa sổ.
- **Audit log** ở từng tab thuật toán: modal riêng cho CT/DWT, công thức TWU/WUS với số liệu thật, tổng trọng số pane vào/ra, đếm ứng viên giữ/cắt, ví dụ giao CTset hoặc WUNList. Chọn tab **Dữ liệu cửa sổ** để xem giao dịch, TWU và chi tiết item/số lượng/trọng số; mỗi trang là một pane, danh sách chỉ cuộn khi pane có hơn 5 giao dịch; tải và dựng tối đa 20 giao dịch mỗi đoạn khi cuộn. Giữ tối đa 48 ví dụ/cửa sổ/thuật toán (tối đa 16 singleton, chừa chỗ cho phép giao), chỉ tải khi mở modal. Mã cửa sổ/phạm vi giao dịch/pane hiển thị một lần ở phần chung; thẻ cửa sổ không chuyển tab. Hai phần **Log khai phá / Dữ liệu cửa sổ** tách riêng, có tìm/lọc ngay trong nhóm ví dụ, tìm item trong giao dịch và nhảy thẳng đến trang pane. Log phân trang tối đa 5 mẫu, tự giảm số dòng khi màn hình thấp; modal và danh sách log không cuộn. Phần cách tính và chi tiết mở riêng. Giữ bộ lọc/ô tìm/trang đang xem khi luồng chạy. Audit tải tối đa một lần/giây, không gửi chồng request và ngừng tải khi tab bị ẩn. Modal tự theo cửa sổ hiện tại: khi cửa sổ trượt, bỏ log cũ và tải log mới, không cần bấm tải lại. Audit không lưu lịch sử và không cắt kết quả khai phá. Xem [API audit](docs/specs/AUDIT_LOG_API.md) và [kiểm chứng/đo tải](docs/reviews/AUDIT_LOG_VERIFICATION.md).
- **So sánh:** thời gian thực thi, bộ nhớ và thời gian cập nhật trên cùng window; tự đối chiếu CT/DWT sau mỗi pane.

Trong Audit log, rê chuột hoặc đưa focus bàn phím vào số có gạch chấm để xem cách tính WUS, TWU và các số tổng hợp; trên điện thoại có thể chạm để mở. Giải thích dùng số liệu của cửa sổ đang xem, không chạy lại khai phá. Nhấn Escape hoặc bấm ra ngoài để đóng phần giải thích.

Hai tab thuật toán cuộn theo trang. Danh sách mẫu dài theo nội dung, không có vùng cuộn riêng trong bảng; giữ tiêu đề cột và tự tải thêm khi cuộn trang, không cắt tập mẫu khai phá. CTset phân trang cố định tối đa 10 dòng/trang, có nút Trước/Sau và số trang. Cây DSWUN hiện mọi tầng/nhánh, tự vừa khung, hỗ trợ nút zoom, con lăn và kéo bằng chuột/cảm ứng. Snapshot cập nhật mỗi 500 ms kể cả khi đang ở tab khác, xem trước tối đa 32 CTset / 64 nút cây; tab CT/DWT tự tải đầy đủ cấu trúc qua `/streams/{id}/structures/{ct,dwt}?sessionId=...&windowId=...` khi vượt phần xem trước. Biểu đồ hiển thị 120 window gần nhất; toàn bộ telemetry được lưu H2 và giữ nguyên khi restart.

Tạm dừng và chờ **Đã tạm dừng** trước khi sửa cấu hình. **CONTINUE** giữ checkpoint. Đổi bộ dữ liệu cần **RESTART** tạo stream mới để tránh trộn nguồn; giữ nguyên stream cũ. Backend restart không tự chạy replay: bấm **Tiếp tục** để khôi phục. Đọc tới EOF chuyển **Hoàn tất**.

## Phép đo và giới hạn

Tham chiếu [bài báo](docs/specs/DeTaiJavaNangCao.pdf), §6.2–6.4. Thời gian đo riêng update/mining bằng nanoTime, không gồm đọc/ghi dữ liệu. Bộ nhớ giữ lại là **ước tính** object graph từng session + kết quả; có lựa chọn lượng cấp phát thật theo thread. Đây không phải peak heap đơn luồng trong paper. Số đo là phiên song song Java trên máy hiện tại, không tái tạo benchmark C# đơn luồng của bài báo.

Window web tối đa 100.000 giao dịch; minWUS=0 hỗ trợ tối đa 16 item/window. Budget mặc định 100.000 mẫu và 1.000.000 transaction-ID references/window. Accidents với minWUS rất thấp có thể vượt budget; lỗi được báo rõ, không trả tập mẫu bị cắt như kết quả hoàn chỉnh. Oracle kiểm chứng window nhỏ (≤16 item, ≤500 giao dịch).

CTset dùng mảng số nguyên và bitset cho tập dày; CT cập nhật tổng TWU của mẫu bằng pane hết hạn/pane mới. DWT duy trì chỉ mục ID theo pane, không quét lại giao dịch thô khi xuất support/IDs. Cây dùng nhánh một con gọn và chỉ tạo WUNList cho item đạt ngưỡng. Kết quả dùng chung từ điển ID bất biến của mỗi cửa sổ, lưu vị trí bằng mảng/bitset.

Benchmark riêng cho cửa sổ lớn (đơn luồng, không H2):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File docs/reviews/probes/run_paper_protocol.ps1 -OnlyPaper -TimeoutSeconds 120 -HeapMiB 768
```

Mỗi lần chạy lưu vào thư mục mới trong `docs/reviews/paper-optimized/runs`, giữ bằng chứng cũ. Lượt lớn dùng hash `compact-ids-v1` bao gồm đầy đủ ID theo thứ tự, nâng trần tham chiếu ID logic lên 1 tỷ vì kết quả được nén, đồng thời giới hạn vùng lưu ID nén 256 MiB. Web vẫn giữ trần 1 triệu tham chiếu. Xem [kết quả tối ưu](docs/reviews/FWUDS_OPTIMIZATION_REPORT.md).

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
