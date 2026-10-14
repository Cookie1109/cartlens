# Báo cáo kiểm thử đối chiếu bài báo

Ngày kiểm thử: 14/10/2026. Tài liệu gốc: [DeTaiJavaNangCao.pdf](../specs/DeTaiJavaNangCao.pdf), 27 trang, SHA-256 `4D32919B9F5A042551995F69F5B2596A498E289BB03207AF02CBF1F240D66869`.

Lượt kiểm chứng bốn mức tiếp theo, gồm mô hình số nguyên và benchmark riêng: [FOUR_LEVEL_VERIFICATION](FOUR_LEVEL_VERIFICATION.md). Báo cáo này giữ kết quả của lượt UI/CSV ban đầu.

## Kết luận

Trong các trường hợp đã kiểm thử, FWUDS-CT và FWUDS-DWT trả đúng tập mẫu, WUS, support và mã giao dịch theo công thức trong bài báo. Dữ liệu DSe, CTset, cây DSWUN, TAILLIST, phân trang và CSV được đối chiếu từ backend tới giao diện trình duyệt. Ở pane=2, window=2 pane, minWUS=0,5: W1 có **9 mẫu**, W2 có **11 mẫu**; CSV toàn phiên của mỗi thuật toán có **20 dòng kết quả**.

Chưa thể kết luận bản triển khai tương đương hoàn toàn với bài báo về chi phí xử lý và benchmark. DWT có thêm một lượt quét cửa sổ phục vụ support/mã giao dịch; phép đo và cách tạo trọng số cho dataset mặc định cũng khác thiết lập thực nghiệm trong bài báo. Các khác biệt được ghi rõ ở cuối báo cáo.

## Cách xác định kết quả kỳ vọng

Đọc trực tiếp PDF và xem hình render ở trang 5, 14, 15 để kiểm tra Fig. 2, Fig. 11 và Fig. 13; không chỉ dựa vào văn bản trích xuất hoặc kết quả hai thuật toán giống nhau.

Kiểm thử bổ sung chép độc lập số lượng và trọng số từ Fig. 2/Table 2. Theo Eq. (1), sáu TWU có dạng số nguyên chia 120: `[57, 84, 44, 116, 52, 126] / 120`. Duyệt toàn bộ 31 tập con khác rỗng của `{A,B,C,D,E}`, xác định các giao dịch chứa mẫu, cộng các tử số, rồi dùng Eq. (2) tính WUS. Quyết định đạt ngưỡng dùng phép so sánh trước phép chia. Backend không gọi `OracleMiner`, `WusCalculator` hay `TwuCalculator` để xác định kết quả kỳ vọng trong kiểm thử mới.

## Phạm vi đã kiểm tra

| Nội dung | Căn cứ trong PDF | Kiểm chứng |
|---|---|---|
| Sáu giao dịch DSe, số lượng và trọng số thay đổi | Fig. 2, Table 2–3 | API và từng dòng/chi tiết trên UI |
| TWU là trung bình `quantity × weight` theo số item | Eq. (1) | Sáu giá trị chính xác và cách làm tròn hiển thị |
| WUS dùng TWU của toàn giao dịch chứa mẫu | Eq. (2), (4), (5), (8) | Tất cả tập mẫu của cả W1/W2, CT và DWT |
| Ngưỡng có dấu `≥` | §3.1, §4.4, §5.3 | Ngưỡng bằng 0,5 và lớn hơn 0,5 một lượng nhỏ; các ngưỡng 0,615/0,72/0,85/1 |
| Đủ window mới có kết quả, pane chưa đủ còn trong buffer | §3.1, Fig. 2, Fig. 4 | Backend và E2E tiến độ pane/window |
| lcTid quay vòng, không giữ TWU của pane cũ | Eq. (6)–(8), Fig. 5–8 | Tất cả CTset W1/W2 và kiểm thử nhiều vòng cập nhật |
| Giao CTset theo thứ tự vòng | Theorem 2, Fig. 8 | Giao rỗng, giao qua điểm quay vòng và dữ liệu nhiều vòng |
| DSWUN giữ cả item B dù chưa đạt ngưỡng | Definition 8, §5.1, Fig. 11 | Tất cả đường đi/trọng số nút của W1/W2 |
| DWT insert pane mới rồi loại pane cũ qua TAILLIST | §5.2, Fig. 12–13 | Trọng số nút, quan hệ cha, pre/post, mã giao dịch và nút đuôi |
| WUNList và giao tổ tiên/hậu duệ | §3.3, Eq. (5) | WUN-code, gộp trọng số cùng tổ tiên, biên ngưỡng và tập mẫu |
| Kết quả xuất đầy đủ | Fig. 4, §4.4, §5.3 | Mọi trang UI, hộp thoại WUS/support/IDs, lịch sử cả hai window và CSV cả hai thuật toán |
| Biểu đồ hiển thị đúng dữ liệu backend | §6.2–6.4 và quy ước phép đo của ứng dụng | Thời gian update+mining, update riêng, chuyển byte sang MiB, chọn từng window |
| Retail/Accidents | Table 4 | Quét toàn tệp độc lập, replay thực qua API/UI |

Các kiểm thử hồi quy hiện có còn đối chiếu Oracle trên 150 luồng ngẫu nhiên với nhiều cửa sổ, item mới/item xuất hiện lại, trọng số thay đổi, utility bằng 0 xen giao dịch dương; kiểm tra lưu trữ, khôi phục và checkpoint. Các kiểm thử E2E hiện có kiểm tra thêm replay Retail 12.000 giao dịch, pause/resume/restart, phản hồi lỗi API và bố cục desktop/mobile.

## Giá trị chính xác và số làm tròn trong bài báo

| Giá trị | Theo công thức | Ví dụ trong bài báo |
|---|---:|---:|
| TWU(t1) | 0,475 | 0,48 |
| TWU(t3) | 11/30 = 0,366666… | 0,37 |
| TWU(t4) | 29/30 = 0,966666… | 0,97 |
| ΣTWU(W1) | 301/120 = 2,508333… | 2,52 khi cộng TWU đã làm tròn |
| WUS(AC,W1) | 217/301 = 0,720930… | ≈0,72 |
| WUS(E,W1) = WUS(EC,W1) | 185/301 = 0,614617… | ≈0,62 khi dùng TWU đã làm tròn |
| ΣTWU(W2) | 169/60 = 2,816666… | 2,82 |
| WUS(A,W2) | 11/13 = 0,846153… | ≈0,85 |
| WUS(E,W2) | 85/169 = 0,502958… | — |

Đây là khác biệt do ví dụ trong bài báo làm tròn TWU trước khi cộng. Ứng dụng giữ DECIMAL128 ở backend và chỉ làm tròn khi hiển thị. Vì vậy ΣTWU(W1) hiển thị 2,51 ở hai chữ số; không nên sửa thành 2,52 để khớp hình mà làm sai Eq. (1)–(2). Với minWUS=0,615, E/EC phải bị loại ở W1. Với minWUS=0,85, A phải bị loại ở W2. Kiểm thử xác nhận cả hai trường hợp.

Ở minWUS=0,5, tập mẫu kỳ vọng được tính độc lập:

- W1: A, AC, ACD, AD, C, CD, CE, D, E.
- W2: A, AC, ACD, ACE, AD, AE, C, CD, CE, D, E.

## Kiểm tra toàn bộ tệp dữ liệu

| Dataset | Giao dịch | Item phân biệt | Độ dài trung bình | Table 4 |
|---|---:|---:|---:|---|
| Retail | 88.162 | 16.470 | 10,305755… → 10,3 | Khớp |
| Accidents | 340.183 | 468 | 33,807891… → 33,8 | Khớp |

Trong tất cả 428.345 giao dịch: không có tổng utility sai/số utility lệch số item, utility âm hay item trùng trong một giao dịch. Kết quả máy đọc được nằm trong [paper-dataset-audit.json](paper-dataset-audit.json); chạy lại bằng:

```powershell
node docs/reviews/probes/paper_dataset_audit.mjs
```

Đây là kiểm tra dữ liệu đầu vào toàn tệp, không phải khai phá toàn bộ hai tệp ở tất cả ngưỡng.

## Kết quả chạy kiểm thử

- Backend: **49/49 đạt**, không failure/error/skip; `mvn verify` và đóng gói Spring Boot thành công. Sau khi thêm trường hợp ngưỡng 0,615, chạy lại riêng `PaperConformanceTest`: **4/4 đạt**.
- Frontend: `corepack pnpm build` thành công, TypeScript và Vite đều đạt.
- E2E toàn bộ: **17/17 đạt**, không failure/skip; gồm **2 kiểm thử mới** đối chiếu bài báo. Lượt cuối hoàn tất trong khoảng 1,7 phút.

Bằng chứng tổng hợp: [paper-conformance-verification.json](paper-conformance-verification.json). Báo cáo chi tiết JUnit nằm tại `backend/target/surefire-reports`; báo cáo Playwright và ảnh W1/W2/CT/DWT nằm tại `frontend/test-results`. Đây là các thư mục sinh từ kiểm thử, có thể bị ghi đè ở lần chạy tiếp theo.

Môi trường: Windows, Java 21.0.8, Playwright/Chromium headless. E2E dùng backend riêng 8081, frontend 5174, archive riêng `tmp/paper-conformance-archive`, không dùng archive ứng dụng ở 8080. Backend test dùng các archive test/TempDir riêng.

Lượt chạy đầu gặp hạn chế môi trường: Maven wrapper tìm sai thư mục HOME trong sandbox; JUnit không dọn được đường dẫn TempDir Windows; máy chủ E2E khởi động bằng Java 8 và thiếu origin CORS cho 5174. Đã xử lý cấu hình chạy và chạy lại. Một assertion đếm mẫu W2 ban đầu ghi nhầm 9 được sửa để lấy số lượng từ phép duyệt tập con độc lập (11). Các kiểm thử so sánh từng mẫu đã xác nhận dữ liệu đúng. Không thay đổi production code để làm kiểm thử đạt.

Kiểm thử bổ sung:

- [PaperConformanceTest.java](../../backend/src/test/java/com/cartlens/mining/PaperConformanceTest.java).
- [paper-conformance.spec.ts](../../frontend/tests/paper-conformance.spec.ts).
- [paper_dataset_audit.mjs](probes/paper_dataset_audit.mjs).

Lệnh chạy thường dùng:

```powershell
# Terminal backend
cd backend
.\mvnw.cmd verify
& "$env:JAVA_HOME/bin/java.exe" -jar target/cartlens-backend-0.0.1-SNAPSHOT.jar --server.port=8081 --cartlens.archive-path=./target/paper-e2e-archive --cartlens.cors.allowed-origin=http://127.0.0.1:5174

# Terminal frontend
cd frontend
$env:VITE_API_BASE_URL='http://localhost:8081/api/v1'
corepack pnpm dev --host 127.0.0.1 --port 5174 --strictPort

# Terminal kiểm thử, tại frontend
corepack pnpm build
$env:PLAYWRIGHT_BROWSERS_PATH='D:/cartlens/tmp/playwright-browsers'
corepack pnpm test:e2e
```

Trong phiên kiểm thử này, Maven được chạy từ bản 3.9.16 đã cache với `-o` và `-Dmaven.repo.local=C:/Users/TRONG NHAN/.m2/repository` để tránh HOME không đúng trong sandbox. Có cấp quyền chạy Maven ngoài sandbox nhằm đọc dependency/dọn TempDir Windows.

## Khác biệt triển khai và giới hạn kết luận

1. **DWT còn quét cửa sổ để xuất metadata.** Trong [FWUDSDWTSession.java](../../backend/src/main/java/com/cartlens/mining/dwt/FWUDSDWTSession.java), phần `mine` dựng lại `BitSet` từ `window.transactions()` để xuất support và transaction IDs. WUS và việc sinh mẫu vẫn dùng WUNList; dữ liệu cây được cập nhật bằng pane/TAILLIST đúng ví dụ. Tuy nhiên toàn bộ bản triển khai có thêm chi phí quét cửa sổ, nên chưa đáp ứng hoàn toàn mục tiêu không quét lại cửa sổ ở §3.4/§5. Đây là kết quả đọc mã nguồn, không phải lỗi giá trị đầu ra đã tái hiện. Nếu yêu cầu sát bài báo về hiệu năng, cần duy trì metadata IDs/support tăng dần hoặc tách phần xuất metadata khỏi đường đo khai phá.
2. **Thiết lập dataset không tái tạo thực nghiệm.** §6.1 gán trọng số ngẫu nhiên [1,10] theo batch; UI mặc định giữ utility trong tệp bằng quantity=1, weight=itemUtility. Cách này bảo toàn tích utility cho Eq. (1), nhưng không chứng minh số lượng mua/trọng số gốc giống dữ liệu thực nghiệm của tác giả.
3. **Benchmark không tương đương.** Bài báo chạy C#/.NET đơn luồng, đo tổng thời gian và bộ nhớ đỉnh trên phần cứng riêng. UI hiện chạy Java song song, đo update/mining mỗi window, bộ nhớ giữ lại ước tính hoặc lượng cấp phát theo thread. Kiểm thử xác nhận UI hiển thị đúng các số đo ứng dụng và ghi rõ phương pháp; không khẳng định số đo hay thứ hạng tốc độ giống hình trong bài báo.
4. **Phạm vi có giới hạn.** Kiểm chứng độc lập toàn bộ tập mẫu dùng dữ liệu DSe và Oracle trên cửa sổ nhỏ. Dữ liệu lớn chủ yếu đối chiếu CT/DWT; quét toàn tệp Retail/Accidents xác nhận định dạng/thống kê. Không tuyên bố chứng minh đúng cho mọi dữ liệu, mọi ngưỡng, hay tái tạo đầy đủ 50 lần trượt trên cả năm dataset của bài báo. Budget và giới hạn window hiện tại của ứng dụng vẫn áp dụng.
