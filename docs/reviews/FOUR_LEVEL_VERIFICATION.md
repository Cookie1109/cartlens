# Kiểm chứng bốn mức tương đương với bài báo

Ngày: 14/10/2026. Tài liệu: [DeTaiJavaNangCao.pdf](../specs/DeTaiJavaNangCao.pdf). Báo cáo đánh giá **hiện trạng**, không sửa thuật toán sản phẩm để biến các mức chưa đạt thành đạt.

## Kết quả tổng hợp

| Mức | Kết luận | Bằng chứng chính |
|---|---|---|
| 1. Kết quả toán học | **Đạt trong miền đã kiểm thử** | DSe; mô hình số nguyên độc lập trên 1.632 cửa sổ; 3.264 kết quả CT/DWT; kiểm thử UI/CSV từ lượt trước |
| 2. Cơ chế thuật toán | **Đạt các bất biến đã kiểm tra; chưa tương đương đầy đủ** | 24.576 phép giao CTset; các bất biến CT/DSWUN/TAILLIST đạt; DWT còn đọc lại cửa sổ để dựng metadata |
| 3. Quy trình thực nghiệm | **Đạt quy trình đơn luồng trên cấu hình nhỏ; chưa tái tạo đầy đủ bài báo** | 8 lần chạy nhỏ đủ 50 lần trượt; Retail đủ kích thước bị giới hạn thời gian ở phép thử thăm dò; Accidents hết heap dưới trần 768 MiB; thiếu ba dataset/baseline/phép đo tương đương |
| 4. Bằng chứng tái lập | **Đạt cho các thí nghiệm hoàn tất** | Seed, cấu hình, SHA-256 nguồn/mã/PDF/JAR, môi trường, snapshot mã và script; lặp JVM mới cho cùng dấu vân tay kết quả |

Không có cơ sở để tuyên bố chương trình tương đương toàn bộ bài báo. Các khác biệt ở mức 2–3 còn tồn tại, dù các giá trị đầu ra được kiểm tra đều đúng.

## Mức 1 — Kết quả toán học

Thêm [PaperInvariantTest.java](../../backend/src/test/java/com/cartlens/mining/PaperInvariantTest.java), độc lập với `OracleMiner`, bộ tính WUS và phép đối chiếu CT/DWT của sản phẩm.

Mỗi transaction có 1–8 item, quantity 1–4, weight 1–10. Vì 2520 chia hết cho các số 1–8, TWU theo Eq. (1) được biểu diễn chính xác bằng số nguyên:

```text
units(t) = Σ(quantity × weight) × (2520 / itemCount)
TWU(t) = units(t) / 2520
WUS(X) = Σ units(t chứa X) / Σ units(t trong window)
```

Duyệt mọi tập con khác rỗng của các item đang có trong cửa sổ; quyết định đạt ngưỡng bằng phép nhân chéo số nguyên/BigDecimal trước khi chia. Sau đó kiểm tra toàn bộ membership, WUS, support và thứ tự mã giao dịch của mỗi thuật toán.

Đã chạy 32 seed cố định, pane size 1–3, window 2–5 pane, các ngưỡng 0/0,1/0,25/0,5/1; mỗi seed có cửa sổ đầu và 50 lần trượt. Có item mới, item rời cửa sổ/xuất hiện lại, dữ liệu sparse/dense và trọng số thay đổi. Kết quả: **1.632 cửa sổ, 3.264 kết quả thuật toán đều đạt**; dung sai kiểm tra WUS/TWU là `1E-28` để phù hợp DECIMAL128.

Các kiểm thử DSe từ lượt trước còn xác nhận Eq. (1)–(2), Fig. 2/Table 2–3, hai cửa sổ W1/W2, ngưỡng sát số làm tròn 0,615/0,72/0,85, dấu ≥ và cách xuất đầy đủ dữ liệu lên UI/CSV. Xem [báo cáo đối chiếu PDF](PAPER_CONFORMANCE_TEST_REPORT.md).

**Giới hạn:** đây là bằng chứng kiểm thử trên miền nêu trên, chưa phải chứng minh hình thức cho mọi đầu vào. Cửa sổ phải có tổng TWU dương; ngưỡng 0 sinh cả mẫu có WUS=0; budget pattern/transaction-reference và giới hạn web vẫn áp dụng. Không khẳng định độ chính xác số thực vô hạn khi dùng DECIMAL128.

## Mức 2 — Cơ chế thuật toán

Các bất biến được kiểm tra sau từng cửa sổ:

- CTset chứa đúng các lcTid theo thứ tự thời gian; lcTid quay vòng trong `[1, |W|]`, không giữ TWU/ID đã hết hạn, map TWU có đúng |W| phần tử, tổng TWU bằng mô hình độc lập.
- TAILLIST chứa đúng các giao dịch hiện tại theo thứ tự; nút đuôi và đường đi cha chứa đúng các item của giao dịch, không lặp item.
- Trọng số từng nút bằng tổng TWU độc lập của các giao dịch đi qua nút; transaction count đúng; không có nút không thuộc đường đi nào.
- Parent/children liên kết hai chiều đúng; thứ tự item trên đường đi phù hợp tree rank; pre/post không trùng và thỏa điều kiện tổ tiên/hậu duệ; không còn rank của item đã rời cửa sổ.
- Toàn bộ tập mẫu khai phá bằng WUNList khớp phép duyệt tập con độc lập, bao gồm các trường hợp item mới/biến mất/xuất hiện lại.

Kiểm tra thêm toàn bộ 64 × 64 cặp tập con trên miền 6 lcTid cho mỗi Curr_lcTid=1…6: **24.576 phép giao** đều khớp phép giao tập hợp đơn giản và giữ thứ tự vòng.

Lập luận bất biến phù hợp giả mã: CT loại các slot pane cũ trước khi tái sử dụng; DWT cộng TWU dọc đường insert rồi trừ đúng TWU dọc đường parent của tail bị loại; với utility không âm, WUS của superset không lớn hơn subset, nên có thể cắt nhánh dưới minWUS. Kiểm thử xác nhận các bước này ở các cấu hình đã chạy; lập luận chưa thay thế một chứng minh hình thức đầy đủ của mã Java.

**Khác biệt còn tồn tại:** [FWUDSDWTSession.java](../../backend/src/main/java/com/cartlens/mining/dwt/FWUDSDWTSession.java) lấy `window.transactions()` và duyệt item để dựng lại BitSet ở mỗi lần `mine`. WUS/sinh mẫu dùng WUNList, nhưng metadata support/IDs có thêm một lượt quét cửa sổ. SlidingWindowManager còn giữ raw transaction objects song song với cấu trúc khai phá. Vì vậy chi phí toàn bộ triển khai/bộ nhớ chưa sát mô hình cấu trúc chuyên biệt của bài báo. Quy tắc giữ nút có transactionCount>0 cũng là phần mở rộng để hỗ trợ utility=0; thực nghiệm bài báo dùng trọng số dương [1,10].

**Để mức 2 đạt đầy đủ hơn:** duy trì riêng chỉ mục metadata theo pane cho DWT, bỏ lượt dựng lại BitSet từ mọi giao dịch, rồi đo/kiểm tra lại chi phí. Mọi sửa đổi này cần giữ các kiểm thử độc lập hiện tại đạt.

## Mức 3 — Quy trình thực nghiệm

Thêm [PaperProtocolBenchmark.java](../../backend/src/main/java/com/cartlens/benchmark/PaperProtocolBenchmark.java). Mỗi lần chạy là một JVM mới, chỉ tạo một session CT hoặc DWT; việc đọc pane/update/mine thực hiện trên cùng một calling thread, không khởi động Spring server/H2 hoặc ParallelMiningSession. Các thuật toán chạy lần lượt. JVM vẫn có các thread nội bộ như GC/JIT; “đơn luồng” ở đây áp dụng cho thuật toán.

Thiết lập chung: pane=1, seed=42, `SYNTHETIC_BATCH`, trọng số xác định theo item/batch trong [1,10], quantity=1 theo mỗi item trong tệp, mục tiêu cửa sổ đầu + 50 lần trượt. Phép đọc/parse được đo riêng, update/mining được cộng dồn từ cửa sổ đầu; sinh dấu vân tay kết quả đo riêng. `totalPipelineMs` còn bao gồm đọc/parse và công việc của harness; không đồng nhất nó với `algorithmTimedMs`.

### Các thí nghiệm hoàn tất

| Profile | Window | minWUS | Batch | Giao dịch/lần chạy | Số lần chạy | Kết quả |
|---|---:|---:|---:|---:|---:|---|
| Retail nhỏ | 1.000 | 0,01 | 100 | 1.050 | CT×2 + DWT×2 | 51 window, 50 lần trượt, tất cả hoàn tất |
| Accidents nhỏ | 40 | 0,9 | 5 | 90 | CT×2 + DWT×2 | 51 window, 50 lần trượt, tất cả hoàn tất |

Những cấu hình nhỏ **không phải** kích thước/minWUS/batch của benchmark đầy đủ trong bài báo. Chúng kiểm tra cơ chế chạy đơn luồng, đủ số lần trượt, đối chiếu dữ liệu thực và tính tái lập của harness.

### Phép thử với kích thước bài báo

Đọc §6.2 và Fig. 15–16 trực tiếp trong PDF: Retail dùng window 88.000 pane, pane=1, ngưỡng cao nhất 0,3% (=0,003), batch=10.000; Accidents dùng window 340.000 pane, pane=1, ngưỡng cao nhất 60% (=0,6), batch=5.000. Đã thử hai cấu hình này với mục tiêu 50 lần trượt, `-Xmx768m` và giới hạn thăm dò 120 giây. Giới hạn thời gian được kiểm tra giữa các pane, nên lần accept cuối có thể làm thời gian thực tế vượt 120 giây.

| Dataset/thuật toán | Kết quả thực tế | Diễn giải |
|---|---|---|
| Retail CT | 16 window / 15 lần trượt; TIME_LIMIT | 88.015 giao dịch; chưa hoàn tất mục tiêu 50 lần trượt |
| Retail DWT | 3 window / 2 lần trượt; TIME_LIMIT | 88.002 giao dịch; chưa hoàn tất mục tiêu 50 lần trượt |
| Accidents CT | OutOfMemoryError: Java heap space | Stack trace ở bước đọc/parse/lưu transaction, trước khi hoàn tất cửa sổ đầu; dưới trần heap 768 MiB |
| Accidents DWT | OutOfMemoryError: Java heap space | Stack trace ở bước đọc/parse/lưu transaction, trước khi hoàn tất cửa sổ đầu; dưới trần heap 768 MiB |

Không suy ra thuật toán cho kết quả sai từ TIME_LIMIT/OOM. Không suy ra chương trình không thể hoàn tất trên máy hoặc heap lớn hơn. Dấu vân tay hai lượt Retail không thể so trực tiếp vì chúng chứa số window khác nhau. Không dùng các thời gian thăm dò để khẳng định thứ hạng/tỷ lệ tốc độ như bài báo.

Máy hiện tại: Windows 11 Home Single Language 10.0.26200, Intel Core i5-13500H, 16 logical processors, RAM khoảng 7,63 GiB (8 GB danh nghĩa), Java 21.0.8. Bài báo dùng i5-9400F, RAM 32 GB, C# 2022/.NET 4.7.2. Nhiều ứng dụng khác vẫn đang mở; các số đo hiện tại không phải môi trường hiệu năng được cô lập hoàn toàn.

Các khoảng trống độc lập với giới hạn thăm dò:

1. API web giới hạn window 100.000 giao dịch, nên không nhận window Accidents 340.000 theo §6.2. Harness riêng đi qua domain trực tiếp để thử cấu hình này.
2. Chưa có BMS-POS, Kosarak, Susy; chưa có baseline dFWUNL-stream. Không tái tạo đủ bảng/biểu đồ trên năm dataset và ba thuật toán.
3. Bài báo không cung cấp seed/chi tiết sinh trọng số đủ để chứng minh các batch ngẫu nhiên hiện tại giống hệt của tác giả.
4. UI vẫn dùng Java song song và trọng số PROVIDED_UTILITY mặc định; thêm harness đơn luồng không làm UI tự trở thành benchmark của paper.
5. Chưa có phép đo bộ nhớ đỉnh của thuật toán tương đương phép đo tác giả. Harness ghi sample heap sau pane, tổng peak từng heap pool và working-set tiến trình quan sát từ bên ngoài. Tổng peak các pool là cận trên vì các pool có thể đạt peak khác thời điểm; working set bao gồm JVM/native/shared pages. Chúng không được ghi là bộ nhớ đỉnh riêng của thuật toán.

Vì các điểm trên, mức 3 **chưa được xác nhận tương đương đầy đủ**. Muốn hoàn tất cần phần triển khai mức 2, nguồn dữ liệu/baseline còn thiếu, chạy đầy đủ các cấu hình trên môi trường đủ tài nguyên và định nghĩa phép đo phù hợp.

## Mức 4 — Bằng chứng tái lập

Đã chạy hai lần mỗi thuật toán/profile nhỏ trong JVM mới; **8 lượt đều exit 0**, mỗi lượt 51 window. Membership, support, thứ tự transaction IDs và WUS làm tròn 24 chữ số tạo cùng SHA-256 giữa hai lần chạy và giữa CT/DWT:

| Profile | SHA-256 kết quả |
|---|---|
| Retail nhỏ | `b62c73cb170c97d050d8fb0052df9e9e58eee34ccf1fc44bc737262492ff24f9` |
| Accidents nhỏ | `c2bd6383e5f09d5bd57eb381f92d088806d5c0613ae8b310477c174dd13a455f` |

Hash bỏ thời gian/bộ nhớ vì các số đo này biến động tự nhiên; không tuyên bố các số đo hiệu năng giống nhau giữa hai lần chạy. WUS ở dấu vân tay chỉ xác nhận tới 24 chữ số thập phân; kiểm thử toán học riêng dùng dung sai `1E-28`.

Bằng chứng lưu bền vững:

- [verification.json](paper-four-level/verification.json): kết quả JUnit, số cửa sổ, SHA mã nguồn, môi trường, kết luận từng mức và lỗi OOM.
- [manifest.json](paper-four-level/manifest.json): từng lệnh, seed/cấu hình JVM, đường dẫn nguồn, thời điểm, trạng thái và số đo process. Bốn lượt thăm dò đầy đủ dùng phiên launcher đầu chưa thu được exitCode; có trạng thái JSON/stack trace để xác định kết quả, không coi exitCode=null là thành công.
- [runs](paper-four-level/runs): JSON từng lượt chạy, hash transaction file/investment metadata, số window, tổng mẫu và các số đo.
- [source-snapshot.zip](paper-four-level/source-snapshot.zip): mã backend/frontend, fixture, test, cấu hình build và script tái lập. Không gồm dữ liệu lớn, dependency cache, secrets hay archive ứng dụng; cần có hai tệp dataset gốc khớp SHA đã lưu.
- [bằng chứng UI/CSV lượt trước](paper-conformance-verification.json): 17/17 E2E và frontend build đạt trên mã thuật toán/UI không thay đổi trong lượt này. Không chạy lại E2E trong lượt này; các thay đổi mới chỉ thêm kiểm thử backend và công cụ benchmark.

Repository có thay đổi chưa commit, nên git HEAD không đủ để tái lập. `verification.json` lưu git HEAD và cờ dirty, hash từng file cùng hash snapshot để ràng buộc đúng nội dung đã kiểm chứng.

### Chạy lại

```powershell
# Tại backend: build và chạy 51 kiểm thử
.\mvnw.cmd verify

# Tại root: đọc/quét lại cả hai dataset, đối chiếu Table 4
node docs/reviews/probes/paper_dataset_audit.mjs

# Tại root: 8 benchmark nhỏ, mỗi thuật toán/profile chạy hai lần
powershell -NoProfile -ExecutionPolicy Bypass -File docs/reviews/probes/run_paper_protocol.ps1

# Thử lại các kích thước của paper nếu có đủ tài nguyên/thời gian
# Timeout và heap phải được ghi cùng kết quả; tăng chúng không bảo đảm hoàn tất.
powershell -NoProfile -ExecutionPolicy Bypass -File docs/reviews/probes/run_paper_protocol.ps1 -OnlyPaper -TimeoutSeconds 600 -HeapMiB 1200

# Kiểm tra hash kết quả lặp/cross-algorithm và tổng hợp bằng chứng
node docs/reviews/probes/verify_paper_evidence.mjs
```

ExecutionPolicy Bypass chỉ áp dụng cho tiến trình PowerShell của lệnh trên, không thay đổi chính sách máy. Các lệnh benchmark không mở cửa sổ GUI, không gửi dữ liệu ra ngoài, không sửa archive của ứng dụng. Script xác định root theo vị trí file; launcher hiện yêu cầu đường dẫn workspace không chứa dấu cách.

Lệnh `verify_paper_evidence.mjs` cần các báo cáo JUnit, manifest, snapshot mã và JAR đã copy ở bước benchmark. Launcher tự ghi `hardware.json` của máy chạy bằng Node.js. Khi chuyển máy, cập nhật JAVA_HOME và chạy lại launcher; không dùng thông tin phần cứng máy cũ như số đo máy mới.

## Kiểm tra hoàn tất của lượt này

`mvn verify`: **51/51 đạt**, không failure/error/skip; đóng gói JAR thành công. Hai test mới mất khoảng 8,7 giây. Tám benchmark nhỏ được chạy lại sau khi sửa launcher để thu exitCode, đều hoàn tất và giữ nguyên hash kết quả. Không sửa FWUDSCTSession/FWUDSDWTSession hoặc UI trong lượt này.
