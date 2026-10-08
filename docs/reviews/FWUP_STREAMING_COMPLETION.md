# Hoàn thiện CartLens cho FWUP và Chainstore liên tục

Ngày kiểm chứng: 08/10/2026. Đối chiếu với `docs/specs/DeTaiJavaNangCao.pdf`, đặc tả ứng dụng và audit trước sửa. Các con số dưới đây là kết quả chạy thực tế trong workspace, không phải số liệu từ bài báo.

> **Rà soát bổ sung:** [review về vận hành thực tế](FWUP_REAL_WORLD_DESIGN_REVIEW.md) phát hiện thiếu sót ở acknowledgement sau commit, reset replay và snapshot đồng thời. Báo cáo này chứng minh các luồng/cấu hình đã kiểm chứng, không xác nhận hệ thống sẵn sàng vận hành tự động lâu dài.

## Kết luận bàn giao

CartLens đã xử lý tăng dần theo pane, giữ session CT/DWT qua các cửa sổ và tiếp nhận Chainstore qua bộ đọc tuần tự. Các lỗi correctness và nút thắt lưu toàn lịch sử RAM/replay mỗi lần mining được nêu trong [audit ban đầu](FWUP_CHAINSTORE_AUDIT.md) đã được sửa. Bộ kiểm chứng nhỏ đối chiếu Oracle; ở quy mô toàn bộ Chainstore, CT và DWT khớp mọi cửa sổ về pattern, WUS, support và transaction IDs.

Đây là ứng dụng demo nghiên cứu có lưu trữ bền vững, không phải hệ thống phân tán hay dịch vụ bán hàng triển khai nhiều máy. Không khẳng định tái hiện toàn bộ thí nghiệm hiệu năng của paper, vì Chainstore và phần cứng đo khác paper.

## Truy vết yêu cầu

| Yêu cầu | Kết quả và bằng chứng |
|---|---|
| Java backend, React/TypeScript, 5 màn hình thật | Backend là nguồn kết quả; frontend build có kiểm tra TypeScript; E2E chạy backend thật |
| TWU, WUS, ngưỡng `>=`, số học không làm tròn trước mining | `TwuCalculator`, DECIMAL128; `MathematicalCoreTest`, boundary/differential tests; archive giữ BigDecimal |
| DSe và phân biệt số chính xác với số paper làm tròn | Fixture `backend/src/test/resources/paper/dse.json`; mathematical, CT/tree/WUNList tests và Oracle |
| Pane chưa đủ và window đầu tiên | `PanePublisher`, `SlidingWindowManager`; chỉ phát pane đủ; chưa đủ window chưa có kết quả |
| FWUDS-CT và circular Tidset | Remove rồi insert; lcTid vòng; giao hai con trỏ theo chronology; CTset và wrap-around tests |
| FWUDS-DWT, DSWUN-tree, TAILLIST, WUNList | Insert rồi evict theo tail; pre/post và singleton lists dựng trong một lượt; giao/prune và đệ quy cùng lớp tương đương |
| Item mới xuất hiện giữa stream | Rank duy nhất và nhất quán; regression nhiều item mới đồng thời, item rời rồi xuất hiện lại |
| Weight thay đổi theo transaction/batch | REST nhận quantity/weight thật; reader có chế độ giữ utility hoặc batch mô phỏng; batch không cần trùng pane |
| Strategy và Observer | `MiningStrategy`/session CT-DWT; `PanePublisher`/`PaneObserver`; không đặt công thức mining trong UI |
| Mining tự động khi pane đến | `StreamState` giữ publisher/session; thêm dữ liệu chỉ xử lý phần mới; cùng cấu hình không khởi tạo lại session |
| Đầy đủ kết quả từng window | Lưu toàn bộ pattern hoặc báo lỗi giới hạn; history/window API và CSV toàn session; không âm thầm cắt kết quả |
| Chainstore liên tục có điều khiển | Reader tuần tự; start/pause/resume/stop, tốc độ, checkpoint; chỉ đọc batch mới khi batch trước lưu/xử lý xong |
| Luồng dài không giữ toàn lịch sử RAM | H2 lưu transaction/result/checkpoint và index ID; state nóng giữ window + partial pane + latest result; cache state có giới hạn |
| Khôi phục sau restart | Đọc cửa sổ đã mining cuối cùng cùng phần commit chưa mining và partial pane; khôi phục windowId/sessionId; replay cần bấm tiếp tục |
| UI và API ở quy mô lớn | Overview/history trả summary; transaction và pattern phân trang; xuất CSV theo trang; polling 1 giây chỉ đọc trạng thái |
| So sánh correctness | Oracle độc lập cho cửa sổ nhỏ; lớn hơn giới hạn so sánh CT/DWT, UI nêu rõ chưa xác nhận bằng Oracle |
| Đo hiệu năng | CLI benchmark tách đọc/validate, update, mining; đo toàn bộ pipeline REST + archive; ghi heap lấy mẫu và retained sau GC |

## Các quy tắc triển khai cần giải thích khi bảo vệ

- Initial tree order theo WUS giảm dần, tie-break item ID. Sau đó giữ tree order nhất quán trong session; item mới được cấp rank mới. `I1` lọc bằng WUS của cửa sổ hiện tại, còn hướng join descendant/ancestor theo rank của cây. Không đổi hướng join chỉ vì WUS thay đổi sau khi trượt. Danh sách lớp đệ quy giữ cùng thứ tự đó; hướng duyệt nội bộ có thể khác thứ tự liệt kê pseudocode nhưng sinh cùng tập pattern.
- Node có thêm số transaction đi qua để không detach nhầm đường đi còn sống nhưng TWU bằng 0. Điều này hỗ trợ input weight không âm mà đặc tả ứng dụng cho phép.
- WUNList vẫn dùng ancestor pre/post, merge cùng pre, AW/WR1/WR2 pruning. Pruning và kiểm tra kết quả cuối dùng cùng phép chia DECIMAL128 như điều kiện WUS, tránh lệch membership tại biên số học.
- Transaction IDs phục vụ UI/đối chiếu được dựng bằng BitSet và phép AND, không quét lại toàn window cho từng pattern. Khai phá WUS vẫn dựa trên CTset/WUNList.

Đây là các lựa chọn triển khai được công khai để bảo đảm correctness khi input thay đổi; không nên mô tả mã Java là bản sao từng dòng pseudocode.

## Bằng chứng kiểm thử

[Tổng hợp kiểm chứng cuối](final-verification.json) lưu kết quả Maven, Playwright và việc tiếp nhận REST sau khi replay đã hoàn tất.

| Gate | Kết quả |
|---|---|
| `backend/mvnw.cmd clean verify` | 38 tests; 0 failures, 0 errors, 0 skipped; BUILD SUCCESS |
| `frontend: pnpm build` | `tsc --noEmit` và Vite production build thành công |
| `frontend: pnpm test:e2e` | 2/2 pass: DSe, Oracle/CT/DWT, lịch sử, Chainstore live, pause/reload/resume, CSV; mobile không tràn ngang |
| Full core Chainstore | 1.112.949 transactions, 1.109 windows, CT/DWT khớp mọi window |
| Batch động | 50.000 transactions, 47 windows; batch=1.500, pane=1.000; CT/DWT khớp tất cả |
| Full REST pipeline và restart | Xem JSON tương ứng; đủ archive, lịch sử, latest, partial pane và kết quả sau restart |

Test hồi quy gồm 150 seed có nhiều item mới/trọng số động ở mọi window, 500 item lần lượt rời cửa sổ, live paths TWU=0, duplicate batch rollback, checkpoint, committed-but-unmined recovery, cache identity và WUS `1/3` qua lưu trữ/phân trang. Core tests không cần UI hay máy chủ database riêng; integration tests dùng H2 embedded tạm.

## Toàn bộ Chainstore

Nguồn có 1.112.949 transaction, 46.086 item; `transactions.txt` 137.044.891 bytes. Cấu hình: pane=1.000, window=4 pane, minWus=0.005; `PROVIDED_UTILITY`; JVM `-Xmx512m`, Java 25.0.1; Intel Core i5-12400F, 6 core/12 logical processors.

[Bằng chứng core benchmark](chainstore-full-benchmark.json):

| Chỉ số | Giá trị |
|---|---:|
| Pane hoàn chỉnh / window đối chiếu | 1.112 / 1.109 |
| Pane cuối chưa đủ | 949 transactions |
| Tổng pattern trên tất cả window | 200.108 |
| Pattern lớn nhất / window | 460 |
| Transaction-ID references lớn nhất / window | 20.048 |
| CT update / mining | 2,63 s / 24,61 s |
| DWT update / mining | 5,40 s / 149,37 s |
| Đọc, parse, validate | 25,93 s |
| Tổng chạy hai thuật toán xen kẽ | 208,39 s |
| Throughput kết hợp | khoảng 5.341 transactions/s |
| Peak heap lấy mẫu trên JVM | khoảng 483,2 MiB |
| Heap sau yêu cầu GC, vẫn giữ session sống | khoảng 21,2 MiB |

Ở cấu hình này CT nhanh hơn DWT. Các thời gian là phép đo trên máy phát triển, có hoạt động kiểm chứng khác cùng máy; không phải thí nghiệm phần cứng cô lập, SLA hay throughput riêng của một thuật toán. Heap peak bao gồm garbage chưa được GC, metadata, hai session và đối chiếu. Heap sau GC là mẫu tham khảo, không phải cam kết JVM luôn giữ mức đó.

[Bằng chứng pipeline REST](chainstore-full-pipeline.json) ghi nhận toàn bộ dữ liệu được nhập và lưu qua ứng dụng thật. Tổng thời gian 311.57 s; xử lý 269.02 s, archive 13.10 s; peak heap lấy mẫu 474.9 MiB với `-Xmx512m`. Trạng thái cuối có window #1.109, 124 pattern, partial pane 949 và 4.949 transaction logic được giữ cho mining, thay vì 1,1 triệu transaction nóng. [Bằng chứng restart](chainstore-restart-verification.json) kiểm tra cả history và pattern pages sau khi mở lại archive.

[Benchmark batch động](chainstore-batch-benchmark.json) và [benchmark window 8 pane](chainstore-larger-window-benchmark.json) bổ sung kiểm chứng trên 50.000 transaction. Các cấu hình khác có thể tạo số candidate/pattern lớn hơn nhiều; cần đo lại trước khi tăng window hay hạ minWus.

## Hợp đồng dữ liệu và giới hạn

Chainstore cung cấp `IDs : total utility : per-item utilities`. Chế độ gốc biểu diễn quantity=1 và weight=utility để giữ tích `w*q` và TWU; không dựng lại quantity mua hàng từ file. `Total Investment` chỉ làm metadata xác nhận item. Chế độ batch tạo weight 1..10 theo seed và thay thế utility gốc; đó là thí nghiệm mô phỏng.

File hiện tại hữu hạn: EOF dừng reader ở trạng thái COMPLETED, giữ partial pane đúng quy tắc. Session vẫn nhận REST transactions để đi tiếp. Đây không phải chế độ theo dõi file được append sau EOF hay kết nối nguồn bán hàng thật.

Ứng dụng giới hạn window web 100.000 transaction, zero-threshold 16 item, mặc định 100.000 pattern và 1.000.000 transaction-ID references/window. Vượt giới hạn báo lỗi, không trả tập pattern bị cắt. Oracle chỉ chạy khi <=16 item và <=500 transaction. Tối đa 2 replay đồng thời, cache mạnh tối đa 16 state không replay; archive tăng trên đĩa theo thời gian.

H2 dùng một backend process cho một archive. Khi đổi cấu hình, hệ thống xây session mới từ archive một lần; khi giữ cấu hình, chỉ cập nhật phần mới. Restart không tự chạy lại job; file nguồn thay đổi hoặc có giao dịch ngoài checkpoint sẽ được báo để tránh tiếp tục sai dữ liệu. Mining lỗi sau commit vẫn giữ dữ liệu trên đĩa và cần cấu hình lại để khôi phục.

## Chạy và tái hiện

Lệnh khởi động, API, env vars, E2E và benchmark nằm trong [README](../../README.md). Demo Chainstore: tạo stream mới → Giao dịch → Cấu hình Chainstore → chọn tốc độ/số giao dịch → Bắt đầu Chainstore. Xem Kết quả để theo dõi và mở lịch sử; So sánh để đối chiếu cửa sổ gần nhất.
