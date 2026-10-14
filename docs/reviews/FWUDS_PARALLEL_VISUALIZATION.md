# Trực quan hóa FWUDS-CT và FWUDS-DWT song song

## Luồng xử lý

Mỗi stream chỉ có một nguồn giao dịch, một cấu hình pane/window/minWUS và một PanePublisher. Khi pane hoàn tất, ParallelMiningSession gửi cùng pane bất biến cho hai session độc lập trên executor 4 worker, queue tối đa 16; phải chờ cả hai trước khi nhận pane tiếp theo. CT giữ thứ tự remove–insert; DWT giữ insert–remove bằng TAILLIST. Thuật toán và phép tính WUS không được thay thế bằng mô phỏng frontend.

Hai kết quả được lưu với session ID riêng để không ghi đè nhau trong archive H2. Endpoint `/streams/{id}/live` xuất bản một snapshot bất biến sau khi cả hai hoàn tất, gồm tổng số mẫu, cấu trúc thật và telemetry của cùng window. So sánh mỗi window kiểm tra membership, WUS (sai số 1E-30), support và transaction IDs. Trường `algorithm` ở các API cũ chỉ chọn lịch sử chính để giữ tương thích; cả hai session luôn chạy.

Frontend lấy snapshot mỗi 500 ms, kể cả khi đang ở tab khác. Các tab FWUDS-CT/FWUDS-DWT chia chiều cao viewport cho cấu trúc và kết quả; số dòng kết quả được tính bằng ResizeObserver và phân trang phía backend. Không cắt tập mẫu để vừa màn hình. CSV mỗi thuật toán xuất toàn phiên. Cấu trúc xem trước tối đa 32 CTset (16 lcTid/item), 64 nút cây và 8 TAILLIST entry; giao CTset minh họa được tính đầy đủ trước khi rút gọn hiển thị. Số lượng phần bị rút gọn được ghi rõ trên UI. Nút cây cho phép xem nhánh và mã WUNList trong phần xem trước.

## Dataset

`dataset` trong replay request là `RETAIL` hoặc `ACCIDENTS`, mặc định RETAIL cho API cũ. Nguồn đọc `Retail-metadata` / `Accidents-metadata`; `CARTLENS_DATASET_ROOT` có thể chỉ định thư mục cha. Dataset được lưu cùng checkpoint và cấu hình. CONTINUE không được đổi dataset; RESTART tạo stream mới và giữ stream cũ. Dữ liệu giữ utility trong file: quantity=1, weight=itemUtility. Không suy diễn số lượng mua hoặc dùng total investment làm weight.

## Biểu đồ và giới hạn phép đo

Tham chiếu `docs/specs/DeTaiJavaNangCao.pdf`, §6.2–6.4:

- Thời gian thực thi của window = update + mining, đo bằng System.nanoTime; không bao gồm đọc file, ghi H2, so sánh kết quả hoặc tạo snapshot.
- Update đo riêng việc duy trì CTset / DSWUN-tree và cửa sổ. Window đầu tiên bao gồm xây dựng cấu trúc; pane chưa đủ window cũng không bị gán kết quả giả.
- Bộ nhớ giữ lại là **ước tính** object graph session + kết quả, tính riêng mỗi thuật toán, theo giả định HotSpot 64 bit/compressed references/alignment 8 byte. Đây không phải peak heap trong bài báo; không đo bộ nhớ tạm phát sinh trong quá trình mining. Có thể chọn số byte cấp phát thật theo từng thread từ ThreadMXBean để quan sát allocation trong update + mining; allocation cũng không đồng nghĩa retained heap.
- Giới hạn 120 window gần nhất trên biểu đồ; số đo mọi window được lưu H2 và giữ nguyên khi khôi phục backend. Không thay số đo gốc bằng thời gian dựng lại session.
- Hai thuật toán chạy song song theo yêu cầu UI; bài báo benchmark đơn luồng C# trên phần cứng khác. Các đường biểu đồ là số đo ứng dụng hiện tại, không sao chép số liệu hay dự đoán thứ hạng từ bài báo. Có trục tuyến tính hoặc log₂(1+y) để hiển thị số đo 0/sub-ms.

Giới hạn window 100.000 giao dịch và budget pattern/transaction references vẫn áp dụng. Cấu hình nhỏ phù hợp trình diễn real-time. Khai phá dense Accidents với minWUS thấp có thể vượt budget; lỗi được báo rõ, không trả một phần mẫu như thể đã hoàn tất.

## Kiểm chứng

Backend: các test hiện có về công thức, CTset, cây, differential mining, streaming/restart/replay; thêm ParallelStreamingTest (Oracle trên từng window, vòng lcTid, phân trang DWT, giữ telemetry khi restart) và DatasetReplayTest (checkpoint/dataset/RESTART). Health test dùng archive riêng để không mở archive của ứng dụng đang chạy.

Frontend: build TypeScript/Vite; Playwright kiểm tra legacy history/replay và các tab mới, không có bộ chọn thuật toán, utility thực từ cả hai dataset, CT=DWT trên cửa sổ thật, và bố cục không cuộn ở desktop/mobile.
