# Rà soát tính phù hợp với dữ liệu và vận hành thực tế

Ngày: 08/10/2026. Đây là lượt kiểm tra bổ sung sau báo cáo hoàn thiện, tập trung vào hợp đồng dữ liệu, tiếp nhận liên tục và lỗi vận hành. Không sửa production code trong lượt review này.

## Kết luận

Thiết kế phù hợp với bài toán nghiên cứu FWUP theo số giao dịch/pane, và đã được kiểm chứng trên toàn bộ file Chainstore hiện có. Chưa nên gọi là hệ thống hoàn chỉnh cho nguồn dữ liệu thực tự động chạy lâu dài: có lỗi hợp đồng tiếp nhận sau commit, trạng thái replay sau reset và thiếu chính sách cho nguồn/lịch sử kéo dài vô hạn.

Báo cáo hoàn thiện trước đó chứng minh correctness và luồng demo ở cấu hình đã chạy; không phải chứng nhận mọi tình huống vận hành. Lượt review này thu hẹp rõ phạm vi kết luận và ghi lại các trường hợp còn thiếu.

## Phần phù hợp

| Khía cạnh | Nhận định |
|---|---|
| Mô hình của paper | Pane theo số transaction; đủ pane mới update/mine; cửa sổ loại phần cũ; không cần event-time/Kafka để tái hiện bài báo |
| Tính toán | TWU là trung bình `weight*quantity` trên item của transaction; WUS là tỷ lệ tổng TWU của transaction chứa pattern; dùng DECIMAL128 và `>=` |
| Thuật toán | CTset, DSWUN-tree/TAILLIST/WUNList, pruning và session tăng dần; Strategy/Observer có vị trí tự nhiên |
| Ý nghĩa Chainstore | Chế độ gốc q=1, w=utility giữ tích và TWU; investments làm metadata; không biến investments thành giá/lợi nhuận đơn vị |
| Chạy dài theo lịch sử | Archive/index trên đĩa; state mining theo window; API/UI phân trang; reader xử lý batch trước rồi mới đọc tiếp |
| Khôi phục | Checkpoint commit cùng transaction; restore window cuối, dữ liệu commit chưa mining và partial pane; không phải replay mining toàn lịch sử sau mỗi lần thêm |
| Correctness đã kiểm chứng | Lượt này chạy lại Maven: 38 tests, không failure/error/skipped. Bằng chứng trước: 1.112.949 transaction, 1.109 window CT/DWT tương đương; Oracle trên dữ liệu nhỏ |

Việc CT và DWT khớp ở quy mô lớn là bằng chứng đối chiếu hai implementation, không thay cho Oracle độc lập trên toàn bộ Chainstore. Các ngưỡng/window khác vẫn cần đo; không suy rộng từ một cấu hình sang mọi tải.

## Findings cần xử lý

### F1 — Ưu tiên cao: lỗi mining bị trả như lỗi nhận dữ liệu sau khi đã commit

Vị trí: `backend/src/main/java/com/cartlens/infrastructure/StreamState.java:77` (`add`), `backend/src/main/java/com/cartlens/api/ApiExceptionHandler.java:39` và transaction POST của `StreamController`.

Tái hiện trên archive riêng:

1. Stream mặc định pane=2, window=2.
2. Nhập 4 transaction, mỗi transaction có một item, quantity=1, weight=0 (DTO cho phép weight không âm).
3. Ba request đầu trả 201; request thứ tư trả 400 `sumTwu(window) must be positive`.
4. Overview vẫn có 4 transaction: request trả lỗi đã được commit.
5. Nhập transaction mới có weight=1 trả 500 vì session đã bị đánh dấu failure.

Tình huống tương tự với pane=1/window=1/minWus=0 và transaction 17 item: guard báo 400 sau khi giao dịch đã lưu. Không mất giao dịch, nhưng producer không biết request đã được nhận, và luồng bị chặn do lỗi khai phá.

Thiết kế cần phân biệt **đã nhận/lưu giao dịch** với **kết quả xử lý window**. Có thể dùng trạng thái xử lý bền vững và trả acknowledgement của ingest, báo lỗi window riêng; hoặc bảo đảm lỗi từ chối xảy ra trước commit với rollback rõ ràng. Cần quy định cửa sổ tổng TWU=0, budget vượt ngưỡng, cách phục hồi và retry cùng ID. Không nên tự bỏ qua window hay âm thầm cắt pattern để tiếp tục.

### F2 — Ưu tiên vừa: reset còn trạng thái replay cũ trong RAM

Vị trí: `ingestion/ReplayService.java:40` (`status` ưu tiên map `jobs`), `infrastructure/StreamState.java:96` (`clear` chỉ reset archive/state).

Tái hiện: replay 4 transaction đến COMPLETED, DELETE transactions, rồi đọc overview/replay. Overview có transactionCount=0 nhưng replay vẫn COMPLETED/processedTransactions=4. Restart hoặc launch job khác có thể xóa tình trạng này, nhưng UI ngay sau reset có thông tin cũ.

Reset cần đồng bộ lifecycle của archive, state và job registry; có generation/session token để trạng thái job cũ không áp vào stream đã reset.

### F3 — Ưu tiên cao khi có thao tác đồng thời: compare chưa bảo vệ snapshot khỏi reset

Vị trí: `application/StreamService.java:46–50`. Đây là phát hiện từ đọc code, chưa tái hiện bằng stress test trong lượt này.

`complete` đọc `state.total()` hai lần; archive được đọc qua nhiều page ngoài khóa của stream. Nếu reset sau khi lấy total và trước khi đọc page, page có thể rỗng. Vòng `cursor += page.size()` không tiến và không có nhánh dừng, nên request có thể lặp vô hạn. Khi input đang tăng, hai lần đọc total cũng có thể cho mốc khác nhau.

Cần chụp một mốc total/generation nhất quán; ngăn hoặc phát hiện reset trong suốt snapshot, và fail rõ khi page rỗng trước mốc dự kiến. Chỉ đọc total một lần giải quyết được một phần, không giải quyết reset giữa các page. Export/history cũng cần hợp đồng snapshot khi reset hay đổi cấu hình đồng thời.

### F4 — Ưu tiên thấp: offset pattern rất lớn gây tràn int

Vị trí: `infrastructure/StreamState.java:119–122`. Tái hiện latest window có 1 pattern, `patternAfter=2147483647&limit=1000`: trả 400 với `fromIndex(1) > toIndex(-2147482649)` do `after+limit` tràn int.

Offset vượt số pattern nên trả trang rỗng, giống nhánh đọc archive. Cần tính end bằng số học không tràn và kiểm tra biên thống nhất.

## Các khoảng trống thiết kế phụ thuộc nhu cầu thực

### Nguồn vào tự động

Reader hiện là replay file tĩnh. EOF thành COMPLETED; backend không theo dõi phần append sau EOF. Fingerprint thay đổi thì resume bị từ chối; restart cần người dùng bấm tiếp tục. REST tiếp nhận được giao dịch mới sau replay, nhưng chưa có producer/adapter tự động kết nối POS, file tăng liên tục hay nguồn khác.

Với demo bài báo, replay tuần tự là đúng. Nếu yêu cầu là dữ liệu mới tự chạy vào liên tục, cần chọn nguồn và hợp đồng offset/acknowledgement/retry trước khi tuyên bố đã đáp ứng. Kafka không phải điều kiện bắt buộc; một adapter có checkpoint và giới hạn tải cũng có thể phù hợp.

### Lưu trữ khi không có điểm kết thúc

RAM mining tăng theo window, nhưng database vẫn tăng theo toàn bộ transactions, kết quả từng window, mọi cấu hình/session và transaction-ID references. Chưa có retention/rollover, quota đĩa, backup/restore được kiểm chứng hay cảnh báo disk-full. Resume file bằng `skip(line)` đọc lại từ đầu đến checkpoint, chưa dùng byte offset.

Cần quyết định giữ raw/history/results bao lâu và deduplicate trong khoảng nào; retention không được làm mất dữ liệu cần restore window, checkpoint hay khiến ID cũ bị nhận lại ngoài ý muốn. CSV trên một session live chưa có mốc kết thúc cố định, vì vòng export đọc tới khi không còn page.

### Tốc độ và ngân sách tài nguyên

Kết quả đo hiện có là một workload/cấu hình trên máy phát triển. CT update+mine khoảng 27,24 s, DWT khoảng 154,77 s trong phép chạy xen kẽ full core; DWT không có ưu thế ở bộ Chainstore/cấu hình này. Preset UI vẫn chọn DWT. Có thể ưu tiên CT cho demo Chainstore này và giữ DWT cho đối chiếu/thí nghiệm.

Giới hạn window/pattern/references là cần thiết nhưng chưa tạo ngân sách tổng cho nhiều stream, số item occurrences/tree nodes hay thời gian mining tối đa. Tối đa 2 reader và cache 16 state không có nghĩa mọi workload đều vừa heap 512 MiB. Chưa đo p95/p99 latency pane, nhiều producer đồng thời hay chạy soak nhiều ngày.

### Ý nghĩa nghiệp vụ

Chainstore không cung cấp quantity mua gốc hay bảng weight đơn vị theo batch trong các file hiện có. Chế độ q=1/w=utility giữ công thức, nhưng không cho phép suy luận lượng mua, biên lợi nhuận sản phẩm hay tổng đầu tư từ pattern. WUS cân theo TWU của **transaction**, không phải lợi nhuận trực tiếp của riêng item/pattern.

Pattern FWUP là tập đồng xuất hiện đạt ngưỡng; chưa phải luật kết hợp A→B, confidence/lift hay khuyến nghị bán hàng. Transaction model không có thời gian, cửa hàng, tiền tệ, sửa/hủy hóa đơn. Những trường này không bắt buộc cho paper; nếu dùng để phân tích POS theo giờ/cửa hàng hoặc xử lý hoàn tiền thì phải có hợp đồng dữ liệu riêng.

## Mức sẵn sàng

| Nhu cầu | Mức đáp ứng |
|---|---|
| Nộp/demo FWUP với luồng pane, hai thuật toán, Strategy/Observer | Phù hợp; cần khắc phục các findings vận hành trước khi gọi hoàn chỉnh |
| Replay file Chainstore hiện tại, một backend, cấu hình đã đo | Đã kiểm chứng về correctness, persistence và tổng tải |
| Nguồn thực tự nhập không có EOF và tự phục hồi | Chưa đủ: adapter/ack/recovery/retention chưa hoàn chỉnh |
| Hệ thống phân tích kinh doanh POS nhiều cửa hàng | Chưa đủ hợp đồng dữ liệu và tầng diễn giải nghiệp vụ |

## Bằng chứng và thứ tự xử lý

1. Sửa hợp đồng commit/ack và xử lý lỗi window (F1); thêm regression cho zero-TWU và budget sau commit.
2. Bảo vệ snapshot/compare khi reset, thêm nhánh không tiến (F3), rồi đồng bộ reset với replay (F2).
3. Sửa biên phân trang (F4); kiểm thử các thao tác đồng thời.
4. Chốt nguồn vào và bổ sung adapter nếu phải chạy tự động; định nghĩa retry/checkpoint/restart.
5. Chốt retention và ngân sách tài nguyên, đo latency/soak với tải dự kiến; giải thích đúng WUS trong báo cáo/demo.

Bằng chứng mới: [JSON các phép tái hiện](design-review-probes.json), [script dùng thư viện Python chuẩn](probes/design_review.py). Chạy backend trên port 8082 với archive thử riêng rồi chạy script từ root bằng `python docs/reviews/probes/design_review.py`; script tạo/reset stream kiểm thử, không dùng archive dữ liệu quan trọng.

Bằng chứng quy mô trước: [full core](chainstore-full-benchmark.json), [pipeline REST](chainstore-full-pipeline.json), [restart](chainstore-restart-verification.json), [batch động](chainstore-batch-benchmark.json), [window lớn hơn](chainstore-larger-window-benchmark.json).
