# Đối chiếu FWUP và khả năng xử lý Chainstore liên tục

Ngày đánh giá: 08/10/2026. Phạm vi: mã nguồn hiện tại, PDF gốc 27 trang, hai file trong Chainstore-metadata và kiểm thử backend. Đây là đánh giá kỹ thuật; chưa đo throughput/heap khi khai phá toàn bộ Chainstore và chưa sửa mã nguồn ứng dụng.

## Kết luận

Chưa đáp ứng đầy đủ mô hình xử lý liên tục và mục tiêu mở rộng của bài báo. Đã có nền tảng toán học, CTset, DSWUN-tree/TAILLIST/WUNList, Strategy/Observer và kiểm thử correctness trên dữ liệu nhỏ. Tuy nhiên DWT có lỗi bỏ sót pattern khi nhiều item mới xuất hiện cùng nhau, ứng dụng chạy bằng cách replay toàn bộ lịch sử, và chưa tích hợp Chainstore.

PDF là bài báo nghiên cứu, không phải bảng rubric độc lập của giảng viên. Yêu cầu ứng dụng Java/React/Strategy/Observer được đối chiếu thêm với docs/specs/HE_THONG_PHAN_TICH_GIO_HANG_FWUP_SPEC.md.

## Bằng chứng kiểm thử

Lệnh: `cd backend; .\mvnw.cmd test`.

Kết quả: BUILD SUCCESS; 23 tests, 0 failures, 0 errors, 0 skipped. Có test DSe, threshold boundary, wrap-around, changing weights và differential test. 30 seed ngẫu nhiên chỉ dùng A/B/C/D; chưa bao phủ trường hợp hai item mới cùng xuất hiện sau initial window.

Phép kiểm chứng bổ sung (chạy ngoài bộ test, không sửa source):

- paneSize=1, windowPaneCount=2, minWus=0.5.
- t1={A}, t2={A}, t3={X,Y}; mọi quantity=1 và weight=1, nên TWU mỗi transaction=1.
- Sau t3, window hiện tại là [t2,t3], sumTWU=2.
- Oracle và CT: A, X, Y, XY đều có WUS=0.5.
- DWT: A, X, Y; thiếu XY.
- Output: `Equivalent=false`, `Differences=[FWUDS_DWT: missing pattern X,Y]`.

Tái hiện: tmp/AuditProbe.java; kết quả: tmp/audit-probe-result.txt. Khi chạy cần classpath backend/target/classes và tmp. Nguyên nhân: DSWUNTree.rank() gán cùng fallback rank cho item không có trong initial window; thứ tự tie-break lúc chèn cây và lúc chọn descendant để intersect không đảo nhất quán.

Nguồn:
- backend/src/main/java/com/cartlens/mining/dwt/DSWUNTree.java:39, 99.
- backend/src/main/java/com/cartlens/mining/dwt/FWUDSDWTSession.java:86.
- backend/src/test/java/com/cartlens/mining/DifferentialMiningTest.java.

## So sánh với bài báo

Bài báo mục 3.4, trang 7-8: pane đến -> cập nhật cấu trúc -> mining -> xuất đầy đủ FWUP của window -> chờ pane tiếp theo. Mục 4 và 5 mô tả tái sử dụng CTset/cây qua các window, không xây lại từ toàn bộ lịch sử.

| Hạng mục | Hiện trạng |
|---|---|
| TWU, WUS, ngưỡng >= và trọng số theo transaction | Có, dùng BigDecimal DECIMAL128; test DSe và boundary pass |
| CTset, lcTid vòng, bỏ pane cũ | Có trong session |
| DSWUN-tree, parent, TAILLIST, WUNList, pruning | Có; còn lỗi correctness với item mới |
| Strategy và Observer | Có: MiningStrategy, PanePublisher/PaneObserver |
| Mining khi pane mới đến trong ứng dụng | Chưa: thêm transaction chỉ lưu, run mới replay |
| Trả kết quả từng window qua API | Chưa: coordinator gom nhiều window nhưng service chỉ trả latest |
| Đọc file Chainstore và phát lại có tốc độ | Chưa có importer/replay source |
| Bộ nhớ giới hạn khi stream dài | Chưa: giữ toàn bộ transaction và gom toàn bộ kết quả trong một run |
| Benchmark runtime, peak memory, scalability như paper | Chưa có; executionTimeMs hiện chỉ đo mine của window, bỏ thời gian cập nhật cấu trúc và replay |

Nguồn mã:
- backend/src/main/java/com/cartlens/service/TwuCalculator.java:11.
- backend/src/main/java/com/cartlens/service/MiningService.java:19: tạo session/publisher mới; publish tất cả transactions; lấy latest.
- backend/src/main/java/com/cartlens/application/StreamService.java:30, 50: add chỉ lưu; run dùng snapshot lịch sử.
- backend/src/main/java/com/cartlens/window/MiningCoordinator.java:16, 27: tích lũy MiningResult.
- backend/src/main/java/com/cartlens/infrastructure/StreamState.java:13, 20, 22: ArrayList lịch sử, copy snapshot, scan tuyến tính để tìm ID trùng.
- backend/src/main/java/com/cartlens/api/StreamController.java:56: GET transactions không phân trang.
- frontend/src/app/AppProvider.tsx:57: refresh lấy toàn bộ transactions; không có stream cập nhật kết quả tự động.

## Chainstore trong workspace

Đã quét tuần tự toàn bộ hai file bằng tmp/profile-chainstore.py. Kết quả thống kê được lưu trong tmp/chainstore-audit.json:

| Chỉ số | Giá trị |
|---|---:|
| transactions.txt | 137,044,891 bytes, khoảng 130.7 MiB |
| Giao dịch | 1,112,949 |
| Item phân biệt | 46,086 |
| Tổng item occurrences | 8,042,879 |
| Độ dài trung bình | 7.2266 |
| Độ dài nhỏ nhất/lớn nhất | 1 / 170 |
| Dòng investment | 46,086 |
| Item thiếu investment | 0 |

Không phát hiện lỗi tách 3 trường, lệch số item/utility, item trùng trong transaction hay tổng utility khác transaction utility khi tính bằng đơn vị 1/100.

transactions.txt có cấu trúc `item IDs : transaction utility : per-item utilities`, khớp dạng utility database được SPMF mô tả. Đây là suy luận từ định dạng và phép kiểm tra tổng, không xác nhận nguồn gốc hai file. Tài liệu chính thức: https://www.philippe-fournier-viger.com/spmf/documentation_218.php.

Không được tự xem per-item utility là quantity, hoặc Total Investment là trọng số đơn vị/batch. Hai file không khai báo rõ quantity, unit weight và weight batch như mô hình paper. Nếu chứng minh utility=u=w*q thì TWU của paper có thể lấy sum(u)/số item, nhưng việc dựng lại q/w/batch cần quy tắc có căn cứ. Có thể dùng q=1, w=u như một phép biểu diễn giữ tích và TWU; cần ghi rõ đây là quy ước chuyển đổi, không phải khôi phục số lượng gốc.

Chainstore không nằm trong Table 4 (trang 17) của PDF. Paper dùng Retail, Accidents, BMS-POS, Kosarak, Susy; để mô phỏng trọng số động, chia batch và gán item weights ngẫu nhiên trong [1,10]. File tĩnh hoàn toàn có thể được đọc tuần tự và phát lại như stream; các pane cần tự kích hoạt cập nhật/mining. Không cần kết nối bán hàng thật để kiểm chứng mô hình này.

## Nút thắt mở rộng

1. StreamState giữ toàn bộ lịch sử RAM và scan tìm duplicate ID mỗi lần thêm: tổng công thêm N ID khác nhau có thể tăng bậc hai.
2. Mỗi lần run replay lịch sử và mining lại các window đã xử lý; coordinator giữ kết quả tất cả window dù API chỉ trả cuối.
3. DWT gọi itemOrder(window) quét raw window, quét raw window cho transactionIds mỗi pattern; tree.wunList(item) đánh pre/post và duyệt toàn cây cho từng item thay vì dựng toàn bộ singleton lists trong một lần duyệt.
4. DWT intersectPattern dựng lại từ singleton cho mỗi candidate thay vì tái sử dụng WUNList của lớp tương đương như pseudocode.
5. CTsetIntersection sorted/copy hai đầu vào mỗi lần giao dù CTset đã giữ thứ tự thời gian.
6. Oracle liệt kê toàn bộ subsets, không cắt nhánh; cần chỉ dùng trên window nhỏ, không dùng cửa sổ Chainstore nhiều item.
7. UI tải/render mọi transaction, minWus slider step=0.01 không chọn chính xác các ngưỡng nhỏ như 0.003/0.002/0.001 của thí nghiệm Retail.

Nguồn: CTsetIntersection.java:9; DSWUNTree.java:80; FWUDSDWTSession.java:86, 103, 110; OracleMiner.java:28; frontend/src/features/mining/MiningPage.tsx:9. Đó là phân tích từ mã, không phải số đo throughput thực tế.

## Thứ tự hoàn thiện

1. Sửa thứ tự item mới trong DWT và bổ sung differential regression cho nhiều item mới, các window liên tiếp.
2. Xác định hợp đồng chuyển đổi Chainstore; xây bộ đọc tuần tự, validation và replay start/pause/resume với tốc độ cấu hình.
3. Giữ publisher/session theo stream+config; mỗi transaction đến chỉ xử lý phần mới; đủ pane thì update -> mine -> phát kết quả window.
4. Giới hạn state nóng theo window+pane buffer; lưu lịch sử ngoài RAM nếu cần, giới hạn kết quả, phân trang UI, dùng index ID phù hợp chính sách lưu trữ và hàng đợi có giới hạn để xử lý khi đầu vào nhanh hơn mining.
5. Tối ưu CT/DWT; bảo vệ Oracle chỉ chạy dữ liệu nhỏ.
6. Benchmark nhiều window trên Chainstore: thời gian đọc/update/mine/tổng, peak heap, throughput, latency mỗi pane, độ tăng queue và số pattern; test trọng số đổi batch. Đối chiếu correctness Oracle ở các mẫu nhỏ, CT với DWT ở quy mô lớn.

Kafka, database hay microservices không phải điều kiện bắt buộc. Yêu cầu thiết yếu là xử lý tăng dần, đúng kết quả, giữ tài nguyên có giới hạn và có bằng chứng đo ở quy mô cần dùng.
