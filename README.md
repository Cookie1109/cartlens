# CartLens

CartLens khai phá Frequent Weighted Utility Patterns (FWUP) trên luồng giao dịch bằng Java 21/Spring Boot và React/TypeScript. Hai thuật toán FWUDS-CT và FWUDS-DWT chạy tại backend; frontend hiển thị kết quả thật.

## Chạy ứng dụng

Yêu cầu: JDK 21+, Node.js 22+, Corepack. H2 embedded được Maven cài tự động, không cần máy chủ database riêng.

Terminal thứ nhất:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Terminal thứ hai:

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Backend: http://localhost:8080. Frontend: http://localhost:5173.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | API của frontend |
| `CARTLENS_CORS_ALLOWED_ORIGIN` | `http://localhost:5173` | Origin frontend được cho phép |
| `CARTLENS_ARCHIVE_PATH` | `./data/cartlens` | Tên file H2, không gồm đuôi `.mv.db`; đường dẫn tương đối theo working directory backend |
| `CARTLENS_CHAINSTORE_DIR` | Tự tìm `Chainstore-metadata` ở root hoặc thư mục cha | Thư mục chứa `transactions.txt` và `investment_table.txt` |

Giữ nguyên archive path khi khởi động lại. Dữ liệu và cấu hình được giữ trên đĩa. Một archive dùng cho một backend process; không mở cùng file H2 bằng hai process.

## Demo DSe

1. Mở **Giao dịch**, chọn **Nạp DSe**.
2. Kết quả tự xuất hiện sau khi đủ pane; cấu hình mặc định là pane=2, window=2 pane, minWus=0.5, FWUDS-DWT.
3. Mở **Kết quả**, xem window #1/#2 qua **Lịch sử window**; dùng **Theo dõi mới nhất** để trở lại luồng live.
4. Mở **So sánh**, bấm **Chạy đối chiếu**: Oracle, CT và DWT phải khớp pattern, WUS, support, transaction IDs.
5. Có thể chọn CT tại **Khai phá** và **Lưu cấu hình**. Giữ cấu hình hiện tại tiếp tục session; đổi cấu hình xây session mới và đọc lại archive một lần.

## Chạy Chainstore liên tục

Hai file phải nằm trong `Chainstore-metadata/` hoặc thư mục do `CARTLENS_CHAINSTORE_DIR` chỉ định.

1. Tại **Tổng quan**, chọn **Stream mới** (hoặc reset một stream đã dừng replay).
2. Tại **Giao dịch** hoặc **Khai phá**, chọn CT/DWT, pane size, số pane/window, MinWUS và weight mode trong cùng form. **Cấu hình Chainstore** điền pane=1000, window=4 pane, minWus=0.005, DWT.
3. Chọn tốc độ: 1000 giao dịch/giây để quan sát; 0 để chạy theo tốc độ xử lý thực tế. Số giao dịch=0 đọc đến cuối file.
4. Chọn **Bắt đầu Chainstore** để lưu và khóa **run configuration** (có ID phiên và phiên bản), gồm cả tốc độ, giới hạn và quy tắc trọng số. Sau khi đủ cửa sổ đầu tiên, mỗi pane mới tự cập nhật cấu trúc, loại pane cũ, mining bằng thuật toán đã chọn và lưu kết quả window. Không cần bấm Run Mining. Bảng giao dịch và kết quả đang xem tự cập nhật theo trang.
5. Đổi cấu hình: **Tạm dừng → chờ Đã tạm dừng → sửa → Áp dụng → Tiếp tục/Restart**. Thay đổi chưa áp dụng sẽ khóa nút Tiếp tục. Nếu đổi CT/DWT, pane, window hoặc MinWUS, chọn tiếp tục từ checkpoint: phiên mining mới dựng lại cửa sổ hiện tại và pane chưa đủ theo ranh giới pane mới, giữ lịch sử phiên cũ, không khai phá lại toàn bộ lịch sử. Nếu không sửa thì Tiếp tục giữ nguyên phiên.
6. Đổi weight mode hoặc seed/batch của trọng số mô phỏng bắt buộc **Restart**: Áp dụng tạo stream mới đang tạm dừng, giữ dữ liệu/lịch sử stream cũ; bấm **Restart** đọc từ giao dịch 1. Có thể chủ động chọn Restart khi đổi cấu hình khác. **Dừng** lưu checkpoint và đóng reader.
7. Khi backend restart, replay không tự khởi chạy: chọn stream cũ và **Tiếp tục** để đọc từ checkpoint. Giao dịch được commit nhưng chưa mining trước khi process dừng sẽ được khôi phục và xử lý.
8. Xem **Kết quả**, đọc giao dịch/pattern theo trang, tải **Xuất CSV toàn phiên** để lấy đầy đủ kết quả các window, kể cả window không có pattern.

Chainstore là nguồn hữu hạn: tới EOF trạng thái là Hoàn tất. Session backend vẫn tiếp tục nhận giao dịch mới qua REST API và tự mining khi đủ pane. Không có cơ chế lặp lại dữ liệu giả hoặc một hàng đợi vô hạn. Reader chỉ đọc batch kế tiếp sau khi batch hiện tại được lưu/xử lý; nếu mining chậm hơn tốc độ yêu cầu, tốc độ nhập tự giảm.

### Ý nghĩa dữ liệu

Dạng file: `item IDs : total utility : per-item utilities`. Parser kiểm tra số item/utility, ID trùng, utility âm, tổng utility và metadata thiếu.

- **Giữ utility gốc:** biểu diễn `quantity=1`, `weight=item utility`. Giữ tích `w*q`, TWU = tổng utility / số item. Không khôi phục hay suy diễn số lượng mua gốc.
- **Mô phỏng theo batch:** `quantity=1`, weight trong [1,10] được tạo theo item, batch và seed; tái hiện được sau pause/resume. Batch không cần trùng pane. Đây là chế độ thí nghiệm, thay thế utility gốc.
- `Total Investment` dùng làm metadata xác nhận item; không tự dùng làm weight đơn vị.

Định dạng utility được mô tả tại [tài liệu SPMF](https://www.philippe-fournier-viger.com/spmf/documentation_218.php). PDF nghiên cứu dùng các dataset khác Chainstore; benchmark Chainstore là kiểm chứng bổ sung cho dự án.

## Kiến trúc và tài nguyên

- Strategy chọn CT/DWT; Observer (`PanePublisher`) phát pane đủ kích thước.
- Session mining sống theo stream+cấu hình; dữ liệu mới không replay lại các window cũ.
- CTset giao tuyến tính theo thứ tự vòng sẵn có; DWT sinh singleton WUNList trong một lần duyệt và tái sử dụng list của lớp tương đương.
- Lịch sử, index ID duy nhất, cấu hình, kết quả và checkpoint lưu trong H2. Trùng ID được kiểm tra bằng index trên đĩa, không quét toàn lịch sử RAM.
- State nóng gồm window gần nhất, pane chưa đủ và latest result. Cache giữ tối đa 16 state không replay; tối đa 2 replay đồng thời, không có queue reader vô hạn.
- Restart đọc window đã mining gần nhất cùng phần dữ liệu còn chờ. API overview/history chỉ trả metadata; endpoint window phân trang pattern. CSV ghi từng trang.

Giới hạn được báo lỗi rõ ràng, không cắt bớt tập FWUP để giả vờ thành công:

- Web window tối đa 100.000 giao dịch.
- `minWus=0` chỉ hỗ trợ tối đa 16 item/window.
- Mặc định tối đa 100.000 pattern và 1.000.000 transaction-ID references/window. Có thể cấu hình JVM `-Dcartlens.max-patterns=...` và `-Dcartlens.max-result-transactions=...` sau khi đánh giá RAM.
- Oracle chỉ chạy trên window tối đa 16 item và 500 giao dịch; window lớn so sánh CT/DWT và UI nêu rõ chưa được Oracle xác nhận.
- Không có authentication/multi-process deployment. Disk archive tăng theo lượng dữ liệu; reset xóa dữ liệu của stream được chọn.
- Các số heap hiển thị được lấy mẫu trên toàn JVM. Đó không phải phép đo bộ nhớ riêng của thuật toán.

## REST API

Prefix `/api/v1`:

| Method | Endpoint | Chức năng |
|---|---|---|
| GET/POST | `/streams` | Liệt kê stream đã lưu/tạo stream |
| GET | `/streams/{id}/overview` | Tổng giao dịch, cấu hình, metrics, tóm tắt latest |
| GET | `/streams/{id}/transactions?after=0&limit=100` | Giao dịch sau sequence (sequence bắt đầu từ 1); limit<=1000 |
| POST/DELETE | `/streams/{id}/transactions` | Thêm giao dịch/reset stream |
| POST | `/streams/{id}/configuration` | Lưu cấu hình, kể cả khi chưa đủ window |
| POST | `/streams/{id}/runs` | Áp dụng cấu hình, trả latest hoặc WINDOW_NOT_READY |
| GET | `/streams/{id}/results/latest` | Kết quả mới nhất |
| GET | `/streams/{id}/results?after=0&limit=20` | Tóm tắt window trong session hiện tại; có thể chỉ định sessionId |
| GET | `/streams/{id}/results/window?sessionId=...&windowId=1&patternAfter=0&limit=100` | Trang pattern của một window |
| GET | `/streams/{id}/results/export.csv?sessionId=...` | CSV toàn bộ session |
| POST | `/streams/{id}/comparisons` | Đối chiếu cửa sổ hoàn chỉnh gần nhất |
| GET | `/datasets/chainstore` | Trạng thái file và số item metadata |
| GET/POST | `/streams/{id}/replay` | Trạng thái/bắt đầu Chainstore |
| POST | `/streams/{id}/replay/{pause,resume,stop}` | Điều khiển replay |
| POST | `/streams/{id}/replay/configuration` | Áp dụng khi đã tạm dừng; trả streamId, replay, restarted |

Replay POST body:

```json
{"algorithm":"FWUDS_DWT","paneSize":1000,"windowPaneCount":4,"minWus":0.005,"transactionsPerSecond":1000,"maxTransactions":0,"weightMode":"PROVIDED_UTILITY","weightBatchSize":10000,"seed":42}
```

Áp dụng dùng body `{ "configuration": <Replay POST body>, "mode": "CONTINUE" hoặc "RESTART" }`. CONTINUE giữ checkpoint và trả PAUSED; RESTART tạo stream mới PAUSED với `restartPending=true`. Sau đó POST resume để chạy. GET replay trả snapshot `request`, `runId`, `configurationVersion`; snapshot được lưu cùng checkpoint.

Endpoint configuration/runs dùng 4 trường đầu. Giao dịch POST nhận `id` và `items` gồm `itemId`, `name`, `quantity` nguyên dương, `weight` không âm. Health: `/api/v1/health`, `/actuator/health`. Lỗi giữ envelope `code`, `message`, `fieldErrors`.

## Kiểm thử

```powershell
cd backend
.\mvnw.cmd clean verify
cd ..\frontend
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

E2E chạy với backend riêng ở 8081, frontend ở 5174:

```powershell
# terminal 1, trong backend
java -Xmx512m -jar target/cartlens-backend-0.0.1-SNAPSHOT.jar --server.port=8081 --cartlens.archive-path=./target/e2e-archive --cartlens.cors.allowed-origin=http://127.0.0.1:5174
# terminal 2, trong frontend
$env:VITE_API_BASE_URL='http://localhost:8081/api/v1'
corepack pnpm dev --host 127.0.0.1 --port 5174 --strictPort
# terminal 3, trong frontend
corepack pnpm exec playwright install chromium --only-shell
corepack pnpm test:e2e
```

Có thể đổi địa chỉ test bằng `CARTLENS_E2E_URL` và `CARTLENS_E2E_API`. Test dùng backend thật, tạo các stream kiểm thử; không chạy trên archive dùng cho dữ liệu quan trọng.

### Benchmark tái hiện

Trong backend sau build:

```powershell
.\mvnw.cmd -q dependency:build-classpath '-Dmdep.outputFile=target/benchmark-classpath.txt'
$env:CLASSPATH=(Resolve-Path target/classes).Path+';'+(Get-Content -Raw target/benchmark-classpath.txt).Trim()
java -Xmx512m com.cartlens.benchmark.StreamingBenchmark --source ../Chainstore-metadata --output ../docs/reviews/chainstore-full-benchmark.json
```

Các tùy chọn: `--pane`, `--window-panes`, `--min-wus`, `--max` (0=toàn bộ), `--weight-mode`, `--weight-batch`, `--seed`. Benchmark chạy CT và DWT trên cùng pane, đối chiếu mọi window, đo đọc/validate, update, mining, tổng thời gian và heap lấy mẫu. Đây là benchmark hai thuật toán chạy xen kẽ, không phải throughput riêng của mỗi thuật toán trên phần cứng paper.

Bằng chứng và checklist bàn giao: [báo cáo hoàn thiện](docs/reviews/FWUP_STREAMING_COMPLETION.md). Đánh giá trước sửa được giữ tại [audit ban đầu](docs/reviews/FWUP_CHAINSTORE_AUDIT.md).
