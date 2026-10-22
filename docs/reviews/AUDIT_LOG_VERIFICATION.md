# Audit log FWUDS-CT / FWUDS-DWT

Kiểm chứng ngày 22/10/2026. Hai tab có nút **Audit log**, mở modal của đúng thuật toán và cửa sổ đã chọn. Audit ghi từ phép tính thật: cập nhật tổng TWU, tử/mẫu số WUS, quyết định giữ/cắt, CTset hoặc WUN-code. DWT cắt sớm ghi cận trên, không dựng WUS giả cho giao chưa tính hết. Khi khôi phục phiên, log phân biệt dựng lại cửa sổ với trượt cửa sổ.

Tham chiếu: [tài liệu gốc](../specs/DeTaiJavaNangCao.pdf), công thức (1), (2), (8), Algorithm 3/6 và Fig. 13/14. Đã đọc văn bản và kiểm tra ảnh các trang có công thức/pseudocode. [Contract API](../specs/AUDIT_LOG_API.md).

## Kiểm chứng tính đúng

- Maven `verify`: **69 test, 0 failure, 0 error, 0 skipped**. Gồm kiểm thử công thức, đối chiếu Oracle, 30 seed ngẫu nhiên, dữ liệu sparse/dense, ngưỡng 0/1 và sát biên, vòng lcTid, pane hết hạn, trọng số thay đổi, restart và dữ liệu lưu trữ.
- DSe: tổng TWU W1 = 301/120, W2 = 338/120; tử số mẫu A tương ứng 217/120 và 286/120. Audit cả hai thuật toán khớp các giá trị độc lập này. Pane vào W2 = 178/120; pane ra = 141/120.
- Audit bất biến sau khi trượt; đủ 511 mẫu/window trong phép thử dense 9 item bất kể bật/tắt capture; chỉ 48 ví dụ được giữ, không cắt kết quả. Nhiều singleton không chiếm hết phần minh họa giao tập. API từ chối sai session/window/ORACLE và xóa audit cũ khi reset.
- Lượt Playwright ban đầu với backend Java thật: **12/12 test đạt**, bao gồm CT/DWT tách biệt, chỉ gọi audit khi mở modal, phân trang, lỗi/thử lại, focus bàn phím và màn hình 375 px. Đồng thời kiểm tra hồi quy kết quả DSe, CSV, CTset, cây, cuộn kết quả và giao diện cấu hình. Bộ test audit hiện kiểm tra tự chuyển sang cửa sổ mới và bỏ phản hồi của cửa sổ cũ; không còn giữ cố định log khi luồng tiến.
- Lượt kiểm chứng modal tự theo cửa sổ hiện tại: **8/8 test đạt** (`audit.spec.ts`, `ux.spec.ts`), gồm tự chuyển W2 sang W3 trong cùng dialog, reset bộ lọc/phần chi tiết, và phản hồi W1 về chậm không ghi đè W3. TypeScript và production build đạt.
- Sau khi thêm dữ liệu nguồn qua nút **Cửa sổ trượt #n**: **10/10 test giao diện đạt**, TypeScript và build đạt. Kiểm tra cả CT/DWT lấy đúng t3–t6 của DSe W2, item/quantity/weight/TWU của t3, tự thay dữ liệu khi sang W3, màn hình 375 px, phân trang giao dịch/item, và loại giao dịch thứ 19 đang trong pane chưa đầy khỏi W2 có phạm vi 7–18. Dữ liệu nguồn dùng API archive hiện hữu, không chạy lại mining; tối đa 10 giao dịch được tải mỗi trang và 10 item được render trong bảng chi tiết.
- Sau khi thêm giải thích phép tính: **12/12 test giao diện đạt**, TypeScript và build đạt. Rê chuột hoặc focus vào các kết quả có gạch chấm sẽ hiện công thức, số thay vào và kết luận; chạm trên điện thoại để mở. Kiểm tra WUS(A,W2) = (286/120)/(338/120), TWU(t3) = (2×0,2 + 1×0,2 + 1×0,5)/3, tổng TWU cửa sổ và bộ đếm. Tooltip nằm trên lớp dialog, không bị cắt bởi vùng cuộn; Escape chỉ đóng tooltip trước, cửa sổ mới loại tooltip cũ. Không gọi thêm API hoặc chạy lại mining khi xem giải thích. Chỉ tạo nội dung giải thích đang mở; phép nhân/cộng phía trình duyệt phục vụ minh họa, kết quả và quyết định giữ/cắt vẫn lấy từ backend.
- TypeScript `--noEmit` và Vite production build đạt.

Không phát hiện sai khác thuật toán trong các trường hợp đã chạy. Không kết luận mọi dữ liệu đều đã được chứng minh đúng; lượt này không chạy lại toàn bộ benchmark Retail/Accidents từ đầu đến cuối. Hai E2E replay Retail/Accidents được loại khỏi lượt kiểm tra trên.

## Giới hạn chi phí audit

- Không tạo thêm executor, thread hoặc hàng đợi log. Hai miner giữ bộ đệm riêng, ghi ngay trong luồng tính toán sẵn có.
- Tối đa 48 ví dụ/thuật toán/cửa sổ, tối đa 16 singleton để chừa chỗ cho phép giao. Mỗi ví dụ tối đa 8 TID/mã và 24 tên item; tên dài được rút gọn. Sau khi hết quota chỉ cập nhật bộ đếm.
- CT lấy lại tử số đã tính trong cache, tránh quét lại CTset chỉ để ghi log. DWT chỉ tạo đối tượng inspection khi còn chỗ ghi ví dụ.
- Chỉ giữ cặp audit của cửa sổ mới nhất; không ghi H2/file, không phát log trong `/live`. API đọc snapshot bất biến, không khóa chờ worker mining. Modal chỉ tải khi đang mở và nhìn thấy, dùng tín hiệu windowId từ live hiện hữu. Gộp các tín hiệu thành tối đa một request/giây và một request đang chạy; đọc snapshot mới nhất thay vì yêu cầu window cũ. Khi trượt, bỏ dòng cũ; phản hồi đã lỗi thời bị bỏ rồi tải snapshot mới; không tạo vòng polling hay bộ nhớ lịch sử. Chỉ phần nội dung được thay, dialog vẫn mở và không lấy lại focus mỗi lần cập nhật. Phân trang 5 ví dụ; giữ bộ lọc, tìm kiếm và trang tương đối khi đổi cửa sổ, đóng mẫu và tooltip cũ. Hai phần log/dữ liệu tách riêng, dữ liệu 10 dòng/trang, item 10 dòng/trang, có nhảy trang và tìm item. Ô nhảy trang và focus được giữ khi luồng chạy; không dựng cây đầy đủ hoặc danh sách pattern phía sau modal. Phần chung trước hai tab ghi mã cửa sổ, khoảng thứ tự giao dịch và pane đúng một lần; tiêu đề modal chỉ ghi thuật toán. Thẻ cửa sổ không chuyển tab. Pane vào/ra nằm trong phần cách tính của tab log. Khoảng thứ tự lấy theo windowId và cấu hình của chính audit, không theo tiến độ live hay ID giao dịch do người dùng nhập. Mặc định hiện số tổng hợp và các dòng mẫu thu gọn; người dùng lọc giữ/loại, mở từng phép tính hoặc phần giải thích khi cần. Header và nút đóng luôn ở đầu modal khi cuộn.

## Đo chi phí capture chi tiết

[Probe Java](probes/AuditLogProbe.java), [stdout gốc](audit-log-20261022/probe-output.txt), Java 25.0.1, CPU i5-12400F (12 logical processors), heap 512 MiB; 10 item, pane=8, 16 pane/window, minWUS=0,2, 51 cửa sổ mỗi lượt. Warm-up 3 cặp lượt, sau đó 7 cặp bật/tắt capture theo thứ tự đảo xen kẽ, lấy trung vị. Hai thuật toán chạy song song trong từng lượt. Baseline tắt ví dụ chi tiết; bộ đếm và tổng pane vẫn tồn tại. Thời gian đo quanh `ParallelMiningSession.accept`, có đo retained graph hiện hữu, không gồm H2, HTTP hay render UI. Cấp phát là tổng của hai worker trong cả lượt, không phải RAM giữ lại đồng thời.

| Dữ liệu tổng hợp | Capture tắt (ms / 51 cửa sổ) | Capture bật (ms / 51 cửa sổ) | Cấp phát tắt/bật (MiB / lượt) | Audit giữ lại tối đa, cả hai thuật toán |
|---|---:|---:|---:|---:|
| Dense, mỗi giao dịch chứa cả 10 item | 176,908 | 179,099 | 498,54 / 511,10 | 52.864 byte |
| Sparse, luôn có I0, item khác xác suất 0,55, seed 42 | 50,216 | 55,967 | 88,98 / 101,43 | 72.752 byte |

Phần thời gian tăng tương ứng khoảng **0,043 ms và 0,113 ms/cửa sổ** trong hai phép thử. Dấu vân tay toàn bộ pattern/WUS/support/ID giống nhau giữa bật/tắt; từng cửa sổ CT khớp DWT. Bốn stream đồng thời hoàn tất **204 cửa sổ**, kết quả giống nhau, không OOM dưới `-Xmx512m`. Audit graph là ước tính `RetainedMemory`, không phải peak heap của JVM. Thời gian có nhiễu JIT/GC và tải máy; không dùng số này làm SLA.

Ghi toàn bộ phép giao và lịch sử không giới hạn có thể gây tăng CPU, cấp phát, I/O và heap khi luồng chạy lâu. Thiết kế hiện tại chặn phần tăng do số bản ghi audit. Khối lượng khai phá chính vẫn có thể vượt budget khi minWUS quá thấp hoặc cửa sổ quá lớn; các giới hạn kết quả/window và cơ chế báo lỗi hiện hữu vẫn được giữ nguyên. Kết quả thử này không đảm bảo mọi cấu hình đều không quá tải.

## Chạy lại

Từ root, sau Maven `verify` và build frontend:

```powershell
java -Xmx512m --class-path backend/target/classes docs/reviews/probes/AuditLogProbe.java
```

Chạy backend thử ở cổng 8081 với archive riêng, CORS `http://127.0.0.1:5174`; frontend cổng 5174 với `VITE_API_BASE_URL=http://localhost:8081/api/v1`. Từ `frontend`:

```powershell
pnpm exec playwright test audit.spec.ts paper-conformance.spec.ts scroll-tree.spec.ts ux.spec.ts parallel.spec.ts --grep-invert 'streams both algorithms'
```

Không dừng/thay thế backend của người dùng đang chạy ở cổng 8080. Cần khởi động lại backend đó để nạp API mới; JAR đã được đóng gói bởi `verify`.

## Tối ưu luồng Accidents liên tục (22/10/2026)

- API audit bỏ `windowId` tùy chọn để đọc snapshot mới nhất nguyên khối; chế độ truyền windowId vẫn kiểm tra khớp nghiêm ngặt. Có kiểm thử isolation, window mới, trước cửa sổ đầu và sau reset.
- Nhận diện thư mục dataset lồng cùng tên tối đa tám cấp; không di chuyển hoặc sửa file nguồn. Accidents hiện tại lồng ba cấp, 152.073.359 byte, bảng đầu tư 468 item.
- Modal giữ chiều cao ổn định khi chuyển window và hiện khung chờ thay cho số liệu cũ; kiểm thử đo chiều cao trước/sau cập nhật.
- Java chạy với heap 512 MiB. Thử replay **12.000 giao dịch**, pane=200, 5 pane/window, minWUS=0,99, 1.000 giao dịch/giây: **56 cửa sổ**, tất cả CT/DWT tương đương. Bộ lọc/query/focus và ô nhảy trang giữ được qua cập nhật. Audit tối đa một request đang chạy, không 404 do trượt cửa sổ. [Số đo JSON](audit-log-20261022/accidents-streaming.json).
- Thử **20.000 giao dịch**, pane=1.000, 10 pane/window (10.000 giao dịch/window), minWUS=0,99, tốc độ không giới hạn: **11 cửa sổ**. Quét trực tiếp 10.000 giao dịch cuối từ file nguồn, cộng utility/số item để lấy TWU, lọc singleton và duyệt hết tập con của ba singleton đạt ngưỡng (`12`, `17`, `18`): **7 pattern**, WUS và support khớp kết quả CT và DWT. [Số đo JSON](audit-log-20261022/accidents-large-window.json).
- Kiểm tra nhảy thẳng trang 1.000, giao dịch cuối ID `20000`, chỉ render 10 dòng; mobile rộng 375px không tràn ngang. [Ảnh desktop](audit-log-20261022/accidents-10000-window.png), [ảnh mobile](audit-log-20261022/accidents-10000-mobile.png).
- **70 kiểm thử backend đạt; 15/15 kiểm thử giao diện đạt**, gồm hai bài Accidents thật. TypeScript và Vite production build đạt. Tooltip đóng bằng Escape rồi focus lại được kiểm tra lặp 5/5 lượt đạt.
- Kiểm tra response cũ bị giữ chậm, retry, đóng modal, ẩn/hiện tab, tìm kiếm/phân trang và tooltip. Giao diện giữ đúng danh tính window; không đưa response cũ trở lại màn hình.

Đây là các lát dữ liệu thật và cấu hình đã đo, **không phải chạy hết file Accidents**, không phải cam kết mọi ngưỡng đều không quá tải. Giới hạn audit chặn tăng log theo thời gian; hạ minWUS trên dữ liệu dày vẫn có thể làm số ứng viên/kết quả khai phá chính tăng mạnh.

Chạy lại: `pnpm exec playwright test audit-streaming.spec.ts audit.spec.ts ux.spec.ts` với backend thử 8081/frontend 5174. Hai bài Accidents bỏ qua khi nguồn không có sẵn; lượt ghi nhận ở trên có nguồn thật và không bỏ qua.

## Sửa tương thích backend đang chạy (22/10/2026)

Ảnh lỗi W2 được xác nhận trên backend hiện tại ở cổng 8080: audit không truyền `windowId` trả HTTP 500/MINING_FAILED, cùng session và `windowId=2` trả HTTP 200. Backend đang chạy vẫn bắt buộc windowId; frontend mới trước đó đã bỏ tham số này. Đây là lỗi tương thích khi nâng cấp.

Client hiện gửi `windowId=<live hint>&latest=true`. Backend cũ nhận đủ tham số và bỏ qua flag mới; backend mới dùng flag để đọc snapshot mới nhất nguyên khối, không phụ thuộc window hint có bị trượt hay chưa. Chế độ strict và cách gọi bỏ windowId vẫn được giữ trên backend mới. Không dùng yêu cầu thất bại để dò phiên bản, không tăng số request hay đổi giới hạn một request/giây.

- Smoke test Playwright trên **frontend thật localhost:5173 / backend thật localhost:8080**, cùng stream W2 trong ảnh: cả CT và DWT trả 200 và modal hiện mẫu, không có cảnh báo lỗi. Chặn mọi request ghi trong smoke test; xác nhận transactionCount và session không đổi. Không dừng/restart backend của người dùng. [Biên bản](audit-log-20261022/live-backend-compatibility.json), [ảnh CT](audit-log-20261022/live-compatible-audit-CT.png), [ảnh DWT](audit-log-20261022/live-compatible-audit-DWT.png).
- 7/7 test API integration đạt, có kiểm tra `latest=true` vẫn lấy đúng window khi hint=999 đã lỗi thời; strict caller tiếp tục từ chối window cũ.
- TypeScript và Vite production build đạt. Bài `audit-compatibility.spec.ts` tự kiểm tra client luôn cung cấp windowId; đặt `CARTLENS_READ_ONLY_STREAM` và trỏ E2E URL/API đến ứng dụng thật để kiểm tra tương thích chỉ đọc.

Backend cũ vẫn có semantics strict, nên có thể báo 404 nếu hint bị trượt khi luồng chạy quá nhanh. Khởi động backend mới sẽ kích hoạt semantics `latest=true`; sửa frontend đã khắc phục trực tiếp lỗi 500 ở ảnh mà không yêu cầu restart backend.

Lượt hồi quy backend mới: 3/3 test giao diện đạt (tương thích + hai replay Accidents 12.000/20.000 giao dịch).

## Gỡ thông tin và thao tác trùng giữa hai tab (22/10/2026)

- Phần nhận diện cửa sổ tĩnh nằm trước tab, chỉ ghi mã window, khoảng giao dịch/pane và trạng thái theo dõi một lần; giữ nguyên DOM khi đổi tab. Bỏ Wn lặp ở tiêu đề modal, badge Wn lặp và nút chuyển tab trên thẻ cửa sổ.
- Chỉ hai tab điều hướng nội dung, dùng role tab/tablist/tabpanel, hỗ trợ phím mũi tên và Home/End. Log chứa ngưỡng WUS, bộ đếm, bộ lọc/tìm ví dụ và công thức. Dữ liệu chứa giao dịch, item và TWU; không lặp bộ đếm, ngưỡng hay công cụ lọc mẫu khai phá.
- Bỏ tiêu đề “Dữ liệu Wn” và số tổng giao dịch lặp. Gộp nhảy trang/trước/sau cùng khoảng dòng đang xem vào một thanh, không còn hai khu vực phân trang.
- 16/16 kiểm thử giao diện đạt, bao gồm phân tách panel, thẻ cửa sổ không còn nút, keyboard navigation, cùng node nhận diện window qua hai tab, dữ liệu chỉ tải khi chọn tab, tương thích backend và hai replay Accidents. TypeScript và production build đạt. Không đổi API hoặc thuật toán ở lượt tinh gọn này.
- [Log khai phá](audit-log-20261022/tabs-mining.png), [dữ liệu giao dịch](audit-log-20261022/tabs-transactions.png), [mobile](audit-log-20261022/tabs-transactions-mobile.png), [biên bản E2E](audit-log-20261022/tabs-ui-report.json).

## Phân trang theo pane, bỏ cuộn modal và log (22/10/2026)

- Modal và danh sách log không cuộn. Log phân trang tối đa 5 dòng; trên màn hình thấp tự giảm số dòng/trang để giữ đủ hàng, tìm kiếm và phân trang trong khung. Search/filter nằm dưới tiêu đề “Ví dụ tính toán”, chỉ lọc các ví dụ audit.
- “Cách tính kết quả”, chi tiết mẫu và item giao dịch mở trong popover riêng để không kéo dài modal. Tooltip lồng bên trong được đóng trước bằng Escape; đóng chi tiết trả focus về nút mở.
- Mỗi trang dữ liệu là một pane: W2 của DSe có trang 1=P2 (t3,t4), trang 2=P3 (t5,t6). Không gom giao dịch thuộc pane khác vào trang. Có pane trước/sau và nhảy đến trang pane trong window.
- Pane ≤5 giao dịch không cuộn. Pane >5 chỉ cuộn danh sách, khung xem tối đa khoảng 5 hàng. Pane lớn không tải toàn bộ: chỉ một block tối đa 20 giao dịch được fetch/render; spacer biểu diễn những hàng còn lại. Một giao dịch đang xem chi tiết có thể được giữ riêng đến khi đóng/đổi pane/window. Request có debounce 50ms và hủy khi block/pane/window đổi; không refetch khi cuộn nhỏ trong block hiện tại.
- **17/17 kiểm thử giao diện đạt**; TypeScript và Vite production build đạt. Có desktop 1280×900, mobile 375×812, landscape 844×430; kiểm tra modal/body scrollTop=0, không tràn ngang, hàng log không bị cắt và tìm kiếm đúng vị trí. Kiểm tra pane 2/6 giao dịch, ranh giới window, item và popover.
- Hai replay Accidents vẫn đạt: 12.000 giao dịch/56 window; 20.000 giao dịch, window 10.000 giao dịch. Trong window lớn có 10 trang pane, mỗi pane 1.000 giao dịch; nhảy đến P20 và cuộn tới ID 20000, không mount quá 20 hàng. Kết quả vẫn khớp phép quét đối chứng ở cấu hình minWUS=0,99.
- [Log desktop](audit-log-20261022/pane-pages/pane-log-CT-1280.png), [log mobile](audit-log-20261022/pane-pages/pane-log-CT-375.png), [pane nhỏ](audit-log-20261022/pane-pages/pane-data-CT-375.png), [pane lớn](audit-log-20261022/pane-pages/accidents-10000-mobile.png), [biên bản E2E](audit-log-20261022/pane-pages/ui-report.json).
