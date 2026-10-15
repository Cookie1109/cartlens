# Khắc phục giới hạn thời gian và heap của FWUDS

Ngày kiểm chứng: 15/10/2026. Mục tiêu: hoàn tất cửa sổ đầu và 50 lần trượt trên Retail và Accidents, giữ pane=1, seed=42, SYNTHETIC_BATCH, heap 768 MiB và giới hạn 120 giây của harness.

## Kết quả kiểm chứng

**Đã khắc phục trên cả bốn cấu hình lớn:** 12/12 lượt benchmark exit 0; mỗi lượt đủ 51 cửa sổ và 50 lần trượt. Backend 63/63 đạt; E2E 17/17 đạt, không lỗi, bỏ qua hoặc flaky.

| Bộ dữ liệu / thuật toán | Pipeline (s) | Update + mining (s) | Heap sau pane lớn nhất lấy mẫu (MiB) |
|---|---:|---:|---:|
| Retail / CT | 57.98 | 56.07 | 349.30 |
| Retail / DWT | 27.27 | 25.36 | 298.00 |
| Accidents / CT | 23.58 | 14.21 | 685.11 |
| Accidents / DWT | 34.02 | 24.12 | 719.44 |

Retail có 71.771 mẫu cộng qua 51 cửa sổ; Accidents có 105.839. Đây không phải số mẫu phân biệt của toàn tệp. Hai thuật toán khớp dấu vân tay của toàn bộ mẫu, WUS 24 chữ số, support và thứ tự ID; tám lượt nhỏ giữ nguyên hash legacy đã kiểm chứng trước đây.

Bằng chứng: [verification.json](optimization-20261015/final-runs/20261015-011023-520/verification.json), [manifest và lệnh chạy](optimization-20261015/final-runs/20261015-011023-520/manifest.json), [môi trường](optimization-20261015/final-runs/20261015-011023-520/hardware.json), [báo cáo E2E](optimization-20261015/final-runs/20261015-011023-520/e2e-report.json). JAR SHA-256: `25b2117a126c5ed38bc21e1a5ddf70c49c3c97a7772e39d0a7c957cdf42ca460`.

## Thay đổi triển khai

- Reader dùng chung item bất biến theo ID/trọng số; bộ nhớ cache bị chặn bởi số item metadata × 10, không tăng theo số batch. Chế độ PROVIDED_UTILITY vẫn giữ nguyên utility gốc.
- CTset dùng mảng int và bitset cho tập dày; bỏ việc giữ giao dịch thô. Tổng TWU của mẫu được cập nhật chính xác bằng cách trừ pane hết hạn và cộng pane mới; mẫu chưa có trong cache được tính lại từ CTset. Cache có giới hạn 100.000 mục.
- Phép cộng TWU dùng các chữ số nguyên không dấu, chuẩn hóa carry một lần; không làm tròn. Đầu vào có scale hoặc độ lớn không hỗ trợ sẽ trở về BigDecimal. WUS đầu ra vẫn dùng DECIMAL128.
- DWT dùng chỉ mục ID tăng dần theo pane, giải phóng giao dịch thô sau khi dựng cây; nhánh một con không tạo map. Các nút mới dùng chung TWU bất biến của giao dịch. Chỉ tạo WUNList của item đạt ngưỡng; mã cây đầy đủ vẫn được duy trì.
- WUNList giữ tổng trọng số còn lại theo vị trí và gộp mã đã có thứ tự. Kiểm tra cận trên được thực hiện sau mỗi 64 bước; chỉ trì hoãn việc cắt nhánh, không bỏ mẫu hợp lệ. Cận bảo thủ giữ quyết định DECIMAL128 tại ngưỡng làm tròn.
- Kết quả giữ đầy đủ support và ID theo thứ tự, dùng chung từ điển ID bất biến và chọn vị trí bằng mảng/bitset. Hash compact-ids-v1 bao gồm từ điển và bitmap của từng mẫu, thay cho việc ghép hàng trăm triệu ID thành chuỗi.
- Phép đo retained graph nhận biết mảng primitive và trường kế thừa; không boxing từng phần tử và không duyệt bung danh sách ID nén.
- Nguồn dữ liệu nhận cả thư mục trực tiếp và thư mục lồng cùng tên. Launcher lưu mỗi lần chạy vào thư mục riêng, không ghi đè bằng chứng trước đó.

## Thiết lập và phạm vi

Retail: window 88.000, minWUS=0,003, batch=10.000, xử lý 88.050 giao dịch. Accidents: window 340.000, minWUS=0,6, batch=5.000, xử lý 340.050 giao dịch. Đây là cửa sổ đầu cộng 50 lần trượt; không khai phá tới EOF của hai tệp 88.162/340.183 giao dịch.

Máy chạy lần này: Windows 11 Pro, Intel Core i5-12400F, 12 bộ xử lý logic, RAM 16 GB danh nghĩa; Java 25.0.1, biên dịch release 21. Máy/Java khác lượt ngày 14/10 nên không dùng thời gian hai đợt để tính tỷ lệ tăng tốc. Mã gốc được biên dịch và chạy lại trên máy hiện tại đã tái hiện OutOfMemoryError lúc đọc Accidents với cùng heap 768 MiB.

Mỗi thuật toán chạy trong một JVM mới, một luồng gọi thuật toán, không Spring server/H2. GC/JIT vẫn có luồng nội bộ. Thời gian pipeline gồm đọc/parse, update, mining và hash; thời gian thuật toán chỉ gồm update+mining. Heap lấy mẫu là toàn JVM sau pane, có thể bỏ sót đỉnh tạm thời. Tổng peak từng heap pool không phải peak heap đồng thời.

Với lượt lớn, launcher đặt trần 1 tỷ tham chiếu ID **logic** do ID được lưu nén, đồng thời áp dụng trần 256 MiB cho vùng chọn ID nén. Không cắt mẫu hay ID. Web vẫn giữ trần 1 triệu tham chiếu và window tối đa 100.000; cửa sổ Accidents 340.000 chạy qua harness riêng.

## Chạy lại

Từ thư mục backend, chạy mvnw.cmd verify với JDK 21+ và dependency tương ứng. Tại root:

~~~powershell
$env:JAVA_HOME='C:/Program Files/Java/jdk-25'
powershell -NoProfile -ExecutionPolicy Bypass -File docs/reviews/probes/run_paper_protocol.ps1 -IncludePaperDefaults -TimeoutSeconds 120 -HeapMiB 768
node docs/reviews/probes/verify_optimized_evidence.mjs <thu-muc-lan-chay>
~~~

Launcher in thư mục bằng chứng khi kết thúc. Verifier kiểm tra exit code, đủ 51 cửa sổ/50 lần trượt, SHA đầu vào, hash kết quả CT/DWT và dấu vân tay legacy của tám lượt nhỏ. Cần có cùng dữ liệu đầu vào và metadata để tái lập.
