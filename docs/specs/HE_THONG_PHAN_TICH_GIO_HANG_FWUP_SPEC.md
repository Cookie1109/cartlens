# BẢN ĐẶC TẢ HỆ THỐNG PHÂN TÍCH GIỎ HÀNG THEO THỜI GIAN THỰC

> **Tên đề tài:** Hệ thống phân tích giỏ hàng theo thời gian thực bằng khai phá Frequent Weighted Utility Patterns (FWUP)
>
> **Backend:** Java
>
> **Frontend:** React + TypeScript + Vite, kế thừa giao diện Figma export trong `Web App for CartLens/`
>
> **Cấu trúc repository đích:** `frontend/` và `backend/` tại thư mục gốc
>
> **Thuật toán bắt buộc:** FWUDS-CT và FWUDS-DWT
>
> **Mẫu thiết kế bắt buộc sử dụng:** Strategy, Observer
>
> **Mục tiêu kép:** (1) đáp ứng yêu cầu môn Java nâng cao bằng việc tái hiện chính xác bài toán/thuật toán trong bài báo; (2) đáp ứng môn Mẫu thiết kế với tối thiểu 2 mẫu thiết kế có lý do sử dụng tự nhiên, không làm thay đổi logic thuật toán.

---

## 1. Mục tiêu và nguyên tắc thiết kế

Hệ thống mô phỏng một luồng hóa đơn mua hàng liên tục. Mỗi hóa đơn là một **dynamic quantitative transaction** gồm các sản phẩm, số lượng mua và bộ trọng số của sản phẩm tại thời điểm/batch tương ứng. Dữ liệu được chia thành các **pane**; một **sliding window** gồm một số pane cố định. Khi pane mới đến, pane cũ nhất bị loại bỏ và hệ thống khai phá lại toàn bộ FWUP trong cửa sổ hiện tại.

Hệ thống phải triển khai **đúng hai thuật toán của bài báo**:

- **FWUDS-CT** sử dụng Circular Tidset (CTset).
- **FWUDS-DWT** sử dụng DSWUN-tree và WUNList.

Nguyên tắc quan trọng nhất của dự án là **correctness first**. Kiến trúc, giao diện, database và Design Pattern không được phép làm thay đổi định nghĩa, công thức, thứ tự cập nhật hoặc logic khai phá được mô tả trong bài báo.

### 1.1. Tiêu chí hoàn thành

Hệ thống chỉ được coi là hoàn thành khi:

1. FWUDS-CT trả về đúng tập FWUP và đúng giá trị WUS cho từng window.
2. FWUDS-DWT trả về đúng tập FWUP và đúng giá trị WUS cho từng window.
3. Hai thuật toán trả về kết quả FWUP tương đương trên cùng input.
4. Kết quả của cả hai thuật toán khớp với **Reference/Oracle Miner** độc lập trên các bộ test nhỏ.
5. Các ví dụ trong bài báo được tái hiện đúng về cấu trúc, tập pattern và quan hệ số học; giá trị tính toán chính xác phải được phân biệt với giá trị đã làm tròn để trình bày trong paper.
6. Sliding window, CTset, lcTid, DSWUN-tree, TAILLIST và WUNList được cập nhật đúng sau mỗi lần trượt cửa sổ.
7. Các Design Pattern chỉ nằm ở lớp điều phối/kiến trúc, không sửa đổi thuật toán để “phù hợp pattern”.

---

## 2. Phạm vi hệ thống

### 2.1. Chức năng bắt buộc

- Nạp dữ liệu giao dịch từ file hoặc dữ liệu test.
- Cấu hình:
  - `paneSize`: số transaction trong một pane (`|P|`).
  - `windowPaneCount`: số pane trong một window (`w`).
  - `minWus`: ngưỡng minimum weighted utility support.
- Tính `twu` cho từng transaction.
- Tạo sliding window đầu tiên.
- Nhận pane mới và trượt window.
- Chạy FWUDS-CT.
- Chạy FWUDS-DWT.
- Trả về toàn bộ FWUP của từng window.
- Hiển thị/xuất `pattern`, `wus`, `windowId` và thuật toán đã sử dụng.
- Chạy bộ kiểm thử correctness.
- Có chế độ so sánh kết quả FWUDS-CT, FWUDS-DWT và Oracle Miner.
- Cung cấp REST API bằng Java để frontend thực hiện các luồng quản lý giao dịch, khai phá, xem kết quả và so sánh thuật toán.
- Tích hợp giao diện React đã export từ Figma; dữ liệu giả và hàm `mine(...)` trong frontend chỉ được dùng trong giai đoạn chuyển tiếp, không phải nguồn kết quả sau khi tích hợp.
- Tách mã nguồn thành đúng hai application folder ở root: `frontend/` và `backend/`; tài liệu dự án tiếp tục nằm trong `docs/`.
- Build và chạy toàn bộ test bằng Maven + JUnit 5 mà không cần UI, HTTP server hoặc database.

### 2.2. Không nằm trong phạm vi

Để giảm rủi ro và giữ trọng tâm vào thuật toán, phiên bản nộp bài **không cần**:

- đăng nhập/đăng ký;
- phân quyền;
- thanh toán;
- quản lý kho;
- hệ thống khuyến nghị hoàn chỉnh;
- microservices;
- message broker như Kafka/RabbitMQ;
- xử lý song song;
- machine learning;
- cloud deployment bắt buộc.

REST API và giao diện web thuộc phạm vi bản demo tích hợp. Tuy nhiên, đăng nhập, database và triển khai cloud vẫn không bắt buộc; backend có thể dùng state in-memory cho một phiên demo.

“Thời gian thực” trong đề tài được hiểu là **dữ liệu pane được đưa vào liên tục và hệ thống cập nhật + khai phá theo từng pane**, đúng với mô hình sliding-window của bài báo; không bắt buộc phải kết nối hệ thống bán hàng thật.

---

## 3. Cơ sở thuật toán phải tuân thủ

### 3.1. Transaction và data stream

Cho tập item `I`. Một transaction `t_k` chứa số lượng `x_kj` của các item xuất hiện trong giao dịch và một bộ trọng số tương ứng. Mỗi transaction có `Tid` riêng.

Data stream là danh sách transaction theo thứ tự thời gian và có thể tiếp tục nhận transaction mới.

Trong ngữ cảnh giỏ hàng:

- `transaction` = một hóa đơn;
- `item` = một sản phẩm;
- `quantity` = số lượng sản phẩm trong hóa đơn;
- `weight` = giá trị/lợi nhuận/mức quan trọng được cung cấp trong bộ dữ liệu;
- `pane` = một nhóm liên tiếp gồm `paneSize` hóa đơn;
- `window` = `windowPaneCount` pane gần nhất.

> **Quy tắc an toàn:** backend không tự suy diễn weight từ giá bán nếu test input đã cung cấp weight. Weight phải được đọc và sử dụng đúng theo dữ liệu đầu vào.

Một **weight batch** có thể bao phủ một hoặc nhiều transaction liên tiếp và **không bắt buộc trùng ranh giới pane**. Ví dụ `DSe` trong paper có `paneSize = 2`, nhưng `dw1` được áp dụng cho `t1..t3`. Implementation phải resolve đúng weight batch của từng transaction trước khi tính TWU.

### 3.2. Sliding window

Nếu:

- `p = |P|` là số transaction trong một pane;
- `w` là số pane trong window;

thì:

```text
|W| = p * w
```

Khi window đã đầy và pane mới đến:

```text
Window hiện tại: [P1, P2, ..., Pw]
Pane mới:        P(w+1)

=> loại P1
=> thêm P(w+1)
=> Window mới: [P2, ..., Pw, P(w+1)]
```

Quy ước lifecycle cho MVP:

- transaction được buffer cho đến khi đủ đúng `paneSize` mới tạo `Pane` và phát sự kiện;
- pane cuối chưa đủ không được tự động pad hoặc khai phá, trừ khi đề I/O chính thức quy định khác;
- chưa trả `MiningResult` khi initial window chưa đủ `windowPaneCount` pane;
- first full window có `windowId = 1`; mỗi lần trượt thành công tăng `windowId` thêm 1;
- `paneSize > 0`, `windowPaneCount > 0`, `0 <= minWus <= 1`;
- trong phạm vi MVP, transaction phải có ít nhất một item, quantity là số nguyên dương, weight không âm và `sumtwu(window) > 0`. Input vi phạm phải fail-fast với thông báo rõ ràng.

### 3.3. Transaction Weighted Utility (TWU)

Phải sử dụng đúng công thức của bài báo:

```text
twu(t_k) = (Σ (weight(item) * quantity(item))) / |t_k|
```

Trong đó `|t_k|` là **cardinality của transaction (số item khác nhau xuất hiện trong transaction)**, không phải tổng quantity.

### 3.4. Weighted Utility Support (WUS)

```text
sumtwu(W_i) = Σ twu(t_k), với t_k thuộc W_i

wus(X, W_i) =
    Σ twu(t_k) của các transaction trong W_i chứa X
    ------------------------------------------------
                     sumtwu(W_i)
```

Pattern `X` là FWUP khi và chỉ khi:

```text
wus(X, W_i) >= minWus
```

Không được thay `>=` bằng `>`.

### 3.5. Quy tắc số thực

Đây là khu vực có nguy cơ làm test sai dù thuật toán đúng.

- Giá trị nội bộ **không được làm tròn theo số chữ số hiển thị trước khi so sánh với `minWus`**.
- Làm tròn hai chữ số của paper chỉ thuộc tầng hiển thị/test presentation, không được đưa ngược vào mining core.
- Java implementation dùng một chính sách số học duy nhất: ưu tiên `BigDecimal` được tạo từ chuỗi input, phép chia dùng `MathContext.DECIMAL128`, không gọi `setScale` trong mining core.
- So sánh threshold bằng giá trị nội bộ (`compareTo`), không so sánh chuỗi đã format và không tự cộng epsilon vào `minWus` trong production code.
- Nếu bộ test của giảng viên quy định precision/epsilon cụ thể thì quy định đó có ưu tiên cao nhất.
- Nếu không có đặc tả precision, assertions cho WUS dùng tolerance nhỏ; assertions membership vẫn phải kiểm tra đúng điều kiện `>= minWus` của mining core.

Các số trong Table 3 và ví dụ WUNList của paper là số đã làm tròn để trình bày. Với dữ liệu gốc, các giá trị tính toán chính xác dùng cho Oracle là:

| Giá trị | Expected nội bộ |
|---|---:|
| `twu(t1)` | `0.475` |
| `twu(t2)` | `0.7` |
| `twu(t3)` | `11/30 = 0.366666...` |
| `twu(t4)` | `29/30 = 0.966666...` |
| `twu(t5)` | `13/30 = 0.433333...` |
| `twu(t6)` | `1.05` |
| `sumtwu(W1)` | `301/120 = 2.508333...` |
| `wus(AC, W1)` | `31/43 = 0.720930...` |
| `sumtwu(W2)` | `169/60 = 2.816666...` |
| `wus(A, W2)` | `11/13 = 0.846153...` |
| `wus(E, W1)` | `185/301 = 0.614617...` |
| `wus(EC, W1)` | `185/301 = 0.614617...` |

---

## 4. Thuật toán FWUDS-CT

### 4.1. Cấu trúc Circular Tidset

Mỗi transaction trong window có một **local transaction identifier (`lcTid`)**. `lcTid` quay vòng trong miền `1..|W|`.

Trước transaction đầu tiên của initial window, `currentLcTid` phải được khởi tạo bằng `0`. Sau đó mỗi transaction mới được cấp `lcTid` theo quy tắc:

```text
lcTid mới = lcTid + 1, nếu lcTid < |W|
lcTid mới = 1,          nếu lcTid = |W|
```

`CTset(X, W_i)` lưu các `lcTid` của transaction trong window `W_i` chứa pattern `X`.

### 4.2. Cấu trúc Java dự kiến

```text
CircularTidset
- LinkedList<Integer> localTransactionIds

CTsetStore
- Map<ItemId, CircularTidset> oneItemCTsets
- Map<Integer, BigDecimal> twuByLcTid
- BigDecimal sumTwu
- int currentLcTid
- int windowTransactionCount
```

Phải ưu tiên `LinkedList`/deque-compatible structure cho CTset vì thuật toán cần thao tác ở hai đầu danh sách khi cập nhật pane.

`twuByLcTid` là state bắt buộc để ánh xạ `lcTid` đang được tái sử dụng tới TWU của transaction hiện nằm trong window. Khi xóa/thêm pane, CTset, `twuByLcTid` và `sumTwu` phải được cập nhật trong cùng transaction logic; không được để `lcTid` mới đọc nhầm TWU của transaction đã rời window.

### 4.3. Update window

Khi window đã đầy:

```text
1. RemoveOldestPane
2. InsertNewPane
3. tìm các 1-FWUP
4. MineFWUPs_CTsets
5. trả kết quả
```

Thứ tự remove trước, insert sau phải được giữ đúng cho FWUDS-CT.

Khoảng `lcTid` của pane cũ phải được xác định đúng theo Algorithm 1/Theorem 1:

```text
rmFrom = 1
rmTo   = paneSize

if currentLcTid < windowTransactionCount:
    rmFrom = currentLcTid + 1
    rmTo   = currentLcTid + paneSize
```

CTset được duyệt từ đầu theo chronological circular order. Gặp phần tử đầu tiên nằm ngoài khoảng cần xóa thì dừng với item đó; không quét/xóa bằng một unordered set.

### 4.4. CTset intersection

Không được dùng một phép giao set tùy ý rồi sắp xếp lại. Phải triển khai cơ chế giao tuyến tính theo circular order của bài báo.

Với mỗi `lcTid <= currentLcTid`, dùng giá trị điều chỉnh:

```text
adjustedLcTid = lcTid + |W|
```

để phân biệt phần transaction mới và cũ trong vòng quay. Sau đó dùng hai con trỏ để giao hai CTset với độ phức tạp tuyến tính theo chiều dài hai danh sách.

### 4.5. Mining

`MineFWUPs_CTsets` phải:

- bắt đầu từ tập 1-FWUP;
- chỉ kết hợp các `(k-1)` pattern có cùng prefix/equivalent class theo thuật toán;
- tạo CTset candidate bằng CTset intersection;
- tính WUS candidate;
- candidate chỉ được đưa vào lớp tiếp theo nếu `wus >= minWus`;
- tiếp tục đệ quy đến khi không còn pattern mới.

---

## 5. Thuật toán FWUDS-DWT

### 5.1. DSWUN-tree

Node của DSWUN-tree phải chứa đúng các thông tin logic sau:

```text
DSWUNNode
- item/name
- weight
- pre
- post
- children
- parent
```

DSWUN-tree giữ thông tin của **toàn bộ current window**, không loại item chỉ vì item đó hiện không frequent. `parent` được giữ để hỗ trợ xóa transaction khi window trượt.

Khi xây tree cho initial window, các transaction được xử lý theo thứ tự thời gian. Item trong mỗi transaction phải được sắp theo thứ tự WUS giảm dần của các item trong initial window như Algorithm 4. Để kết quả deterministic, nếu hai item có cùng WUS thì tie-break theo `itemId` tăng dần. Comparator này phải được định nghĩa một lần và có unit test riêng.

Cần phân biệt hai thứ tự:

- **tree order:** thiết lập khi xây initial DSWUN-tree và được dùng nhất quán để sắp item của các transaction mới trước `InsertTree`; không đổi tree order giữa session nếu không rebuild toàn bộ tree;
- **mining order:** `I1` của current window được sắp theo WUS hiện tại để tạo/join WUNList.

### 5.2. TAILLIST

`TAILLIST` lưu đúng một entry cho mỗi transaction đã đưa vào DSWUN-tree, theo thứ tự thời gian. Chỉ lưu node là chưa đủ vì Algorithm 5 cần biết TWU của transaction đang bị xóa.

```text
TailEntry
- transactionId
- transactionTwu
- tailNode

TailList
- Deque<TailEntry> entries
```

Khi xóa transaction cũ:

1. lấy `TailEntry` đầu tiên;
2. bắt đầu từ `tailNode`, lưu `parent` trước khi có thể detach node;
3. trừ `transactionTwu` khỏi node;
4. nếu weight trở về 0 thì xóa node khỏi parent;
5. đi lên parent đã lưu và tiếp tục trừ cùng TWU;
6. dừng tại root;
7. xóa phần tử đầu TAILLIST.

### 5.3. Update DSWUN-tree

Phải bám pseudocode của paper. Đặc biệt, paper mô tả `Update_DSWUN-tree` **insert pane mới trước, sau đó loại `|P|` transaction cũ thông qua TAILLIST**. Không được tự ý đổi thứ tự chỉ vì FWUDS-CT dùng remove-then-insert.

DSWUN-tree có lifecycle riêng và không được phụ thuộc vào việc `SlidingWindowManager` đã remove pane cũ theo thứ tự của FWUDS-CT. Logical window snapshot có thể dùng chung ở dạng immutable, nhưng mutation của CTset và DSWUN-tree phải do từng strategy/session tự quản lý.

### 5.4. WUNList

Một WUN-code gồm:

```text
<pre, post, weight>
```

WUNList của pattern là danh sách các WUN-code.

Tập `I1` gồm các 1-FWUP và được sắp theo WUS giảm dần; tie-break theo `itemId` tăng dần. Thứ tự này quyết định hướng join và thứ tự duyệt trong `MineFWUPs_WUNList`, vì vậy không được thay bằng iteration order của `HashMap`/`HashSet`.

Điều kiện ancestor phải giữ chính xác:

```text
pre_j < pre_i && post_j > post_i
```

Khi tạo WUNList mới, các WUN-code có cùng `pre` phải được merge và cộng `weight`.

WUS từ WUNList:

```text
wus(P) = Σ code.weight / sumtwu
```

#### 5.4.1. Contract của WUNList intersection

Implementation phải chọn và test nhất quán một trong hai contract sau; MVP ưu tiên **Contract A** để bám sát Algorithm 6 của paper.

**Contract A - đúng Algorithm 6:**

- intersection nhận hai WUNList theo đúng hướng descendant/ancestor được quyết định bởi thứ tự `I1`;
- duy trì `AW`, `WR1`, `WR2`;
- sau mỗi bước, nếu:

```text
AW + min(WR1, WR2) < minWus * sumtwu
```

thì trả `NULL` để prune;
- WUNList khác `NULL` mới được đưa vào `FWUPs` và lớp đệ quy tiếp theo, đúng với pseudocode.

**Contract B - biến thể correctness-equivalent nhưng không phải pseudocode nguyên bản:** intersection luôn trả list, sau đó caller bắt buộc tính lại WUS và chỉ nhận pattern khi `wus >= minWus`.

Không được dùng mining logic của Contract A với intersection của Contract B, vì khi đó mọi WUNList khác rỗng có thể bị coi nhầm là frequent.

### 5.5. Mining

Luồng FWUDS-DWT:

```text
1. Update_DSWUN_tree
2. xác định 1-FWUP và I1
3. traverse tree để gán pre/post và tạo WUNList cho I1
4. MineFWUPs_WUNList bằng depth-first search
5. trả toàn bộ FWUP của current window
```

Việc sắp thứ tự item, xây DSWUN-tree, gán `pre/post`, tạo/intersect WUNList phải được cô lập thành các hàm nhỏ để có thể unit test riêng.

Sau mỗi lần tree thay đổi, `pre/post` và WUNList phải được tạo lại từ current tree cho current window. DSWUN-tree vẫn giữ toàn bộ item; chỉ bước tạo `I1`/WUNList mới lọc item theo `minWus`.

---

## 6. Kiến trúc hệ thống frontend/backend

### 6.1. Cấu trúc repository đích

```text
CartLens/
|-- frontend/                         # React + TypeScript + Vite
|   |-- src/
|   |   |-- app/                      # bootstrap, navigation, providers
|   |   |-- components/               # UI dùng chung
|   |   |-- features/
|   |   |   |-- overview/
|   |   |   |-- transactions/
|   |   |   |-- mining/
|   |   |   |-- results/
|   |   |   +-- comparison/
|   |   |-- services/                 # REST client
|   |   +-- types/                    # API/domain view models
|   |-- package.json
|   +-- vite.config.ts
|
|-- backend/                          # Java + Maven + Spring Boot
|   |-- pom.xml
|   +-- src/
|       |-- main/java/com/cartlens/
|       |-- main/resources/
|       +-- test/
|
+-- docs/
    |-- specs/
    +-- plans/
```

Thư mục `Web App for CartLens/` là nguồn frontend hiện tại do Figma export và sẽ được chuyển thành `frontend/` ở bước khởi tạo dự án. Việc chuyển thư mục phải giữ nguyên giao diện trước khi tách component hoặc thay dữ liệu giả bằng API.

### 6.2. Kiến trúc tổng quát

```text
React frontend
     |
     | JSON/HTTP: /api/v1
     v
Spring REST controllers -> application services -> PanePublisher
                                                  |
                                           PaneArrivedEvent
                                                  |
                                                  v
                                      MiningCoordinator (Observer)
                                                  |
                                          MiningStrategy
                                                  |
                                           MiningSession
                                           /           \
                                  FWUDSCTSession    FWUDSDWTSession
                                       |                  |
                               CTset + TWU ring     DSWUN-tree + TAILLIST
                                                          + WUNList
                                           \             /
                                            \           /
                                              MiningResult
                                                   |
                                      response DTO / in-memory store
```

`SlidingWindowManager` quản lý logical window/snapshot phục vụ output và Oracle. Mỗi `MiningSession` tự sở hữu state gia tăng của thuật toán và thực hiện đúng thứ tự update riêng; không dùng chung mutable CTset/tree giữa các session.

Frontend chỉ chịu trách nhiệm nhập liệu, điều hướng, gọi API và trình bày. Frontend **không được tự tính TWU/WUS hoặc quyết định một pattern có phải FWUP** sau khi hoàn tất tích hợp. Backend là nguồn sự thật duy nhất cho kết quả khai phá.

Các domain object và thuật toán phải là Java thuần, không phụ thuộc annotation hoặc HTTP class của Spring. Controller chuyển request DTO sang domain command và chuyển `MiningResult` sang response DTO; không trả trực tiếp entity/state nội bộ.

### 6.3. Package structure backend đề xuất

```text
backend/src/main/java/com/cartlens/
|
+-- domain/
|   +-- Item.java
|   +-- Transaction.java
|   +-- TransactionItem.java
|   +-- Pane.java
|   +-- SlidingWindow.java
|   +-- Pattern.java
|   +-- PatternResult.java
|   +-- MiningResult.java
|   +-- MiningConfig.java
|
+-- mining/
|   +-- MiningStrategy.java
|   +-- MiningSession.java
|   |
|   +-- ct/
|   |   +-- FWUDSCTStrategy.java
|   |   +-- FWUDSCTSession.java
|   |   +-- CircularTidset.java
|   |   +-- CTsetStore.java
|   |   +-- CTsetIntersection.java
|   |
|   +-- dwt/
|       +-- FWUDSDWTStrategy.java
|       +-- FWUDSDWTSession.java
|       +-- DSWUNTree.java
|       +-- DSWUNNode.java
|       +-- TailList.java
|       +-- TailEntry.java
|       +-- WUNCode.java
|       +-- WUNList.java
|       +-- WUNListIntersection.java
|
+-- window/
|   +-- SlidingWindowManager.java
|   +-- PanePublisher.java
|   +-- PaneObserver.java
|   +-- MiningCoordinator.java
|
+-- service/
|   +-- MiningService.java
|   +-- TwuCalculator.java
|   +-- WusCalculator.java
|
+-- application/
|   +-- StreamService.java
|   +-- ComparisonService.java
|   +-- dto/
|
+-- verification/
|   +-- OracleMiner.java
|   +-- ResultComparator.java
|
+-- api/
|   +-- StreamController.java
|   +-- MiningController.java
|   +-- ComparisonController.java
|   +-- ApiExceptionHandler.java
|
+-- infrastructure/
    +-- InMemoryStreamStore.java
```

`verification` là code kiểm chứng, **không được FWUDS-CT/FWUDS-DWT gọi ngược lại** để tạo kết quả. Nếu thuật toán production dùng Oracle để “qua test”, việc kiểm chứng mất ý nghĩa.

### 6.4. Trạng thái frontend hiện tại và hướng chuyển đổi

Figma export hiện có năm màn hình: **Tổng quan**, **Giao dịch**, **Khai phá mẫu**, **Kết quả khai phá** và **So sánh thuật toán**. `src/App.tsx` hiện gom component, state, seed data và thuật toán mô phỏng trong một file.

Khi tích hợp phải:

1. giữ nguyên hành vi và hình thức của năm màn hình;
2. tách type/component/service theo feature, không viết thêm nghiệp vụ vào `App.tsx`;
3. thay `seedTransactions`, `mine` và `setTimeout` mô phỏng bằng REST client;
4. có trạng thái loading, empty và lỗi API rõ ràng;
5. cấu hình base URL qua `VITE_API_BASE_URL`, không hard-code host/port;
6. map enum UI `FWUDS-CT`/`FWUDS-DWT` sang API `FWUDS_CT`/`FWUDS_DWT` tại một adapter duy nhất.

---

## 7. Design Patterns - chỉ dùng 2 mẫu cần thiết

Dự án cố ý chỉ sử dụng **2 GoF Design Patterns chính** để tránh over-engineering.

### 7.1. Strategy Pattern - bắt buộc

**Vấn đề:** hệ thống có hai thuật toán khác nhau giải cùng một bài toán và cần cho phép chạy/chọn/so sánh chúng mà tầng service không phụ thuộc vào chi tiết CTset hay DSWUN-tree.

```java
public interface MiningStrategy {
    MiningSession start(MiningConfig config);
}

public interface MiningSession {
    Optional<MiningResult> accept(Pane completedPane);
}
```

Hai implementation:

```text
MiningStrategy
    |
    +-- FWUDSCTStrategy -> FWUDSCTSession
    |
    +-- FWUDSDWTStrategy -> FWUDSDWTSession
```

`MiningService` nhận một `MiningStrategy`, tạo session cho một lần chạy và chỉ gọi contract chung. `accept` trả empty khi initial window chưa đầy; sau khi đủ window, nó trả result cho first window và mỗi pane tiếp theo.

Mỗi lần chạy, mỗi thuật toán phải có session mới. Compare mode tạo ba execution state độc lập cho Oracle, FWUDS-CT và FWUDS-DWT; không tái sử dụng mutable state giữa test hoặc giữa hai strategy.

**Lý do pattern này là cần thiết:** hai thuật toán là hai chiến lược thay thế nhau cho cùng tác vụ FWUP mining. Đây là biến thể thực sự của hành vi, không phải pattern được thêm để đủ số lượng.

### 7.2. Observer Pattern - bắt buộc

**Vấn đề:** hệ thống xử lý data stream theo pane. Khi một pane hoàn chỉnh mới đến, thành phần quản lý stream cần phát tín hiệu để quá trình cập nhật window và mining được kích hoạt mà nguồn dữ liệu không phụ thuộc trực tiếp vào thuật toán cụ thể.

```java
public interface PaneObserver {
    void onPaneArrived(Pane pane);
}
```

```text
PanePublisher
     |
     | notify(newPane)
     v
MiningCoordinator (Observer)
     |
     +--> cập nhật logical window snapshot
     +--> chuyển completed pane vào selected MiningSession
     +--> publish/store MiningResult
```

**Giới hạn:** Observer chỉ điều phối sự kiện pane. Nó **không** được chứa công thức TWU/WUS, CTset intersection, tree update hay WUNList mining. `PanePublisher` chỉ phát pane đã đủ đúng `paneSize`.

### 7.3. Các pattern cố ý không dùng

Không dùng `Singleton`, `Facade`, `Decorator`, `Command`, `Abstract Factory`... chỉ để tăng số lượng pattern. Nếu sau này phát sinh một yêu cầu kỹ thuật thực sự cần chúng mới bổ sung.

Đặc biệt, không dùng Singleton cho configuration vì global mutable state làm test khó cô lập và dễ khiến test này ảnh hưởng test khác.

---

## 8. REST API cho frontend

REST API là phần bắt buộc của bản demo tích hợp, nhưng thuật toán vẫn phải chạy trực tiếp qua Java service/JUnit mà **không phụ thuộc HTTP hoặc Spring context**. API dùng prefix `/api/v1`; JSON dùng `camelCase`; thời gian trả về bằng millisecond; số WUS được serialize từ giá trị full precision, frontend tự format khi hiển thị.

Backend duy trì một `streamId` cho mỗi phiên làm việc trong in-memory store. Không sử dụng static mutable state trong mining session.

| Method | Endpoint | Mục đích |
|---|---|---|
| `POST` | `/api/v1/streams` | Tạo stream và trả `streamId` |
| `GET` | `/api/v1/streams/{streamId}/overview` | Lấy số giao dịch, pane/window hiện tại và lần chạy gần nhất |
| `GET` | `/api/v1/streams/{streamId}/transactions` | Lấy danh sách giao dịch theo thứ tự nhập |
| `POST` | `/api/v1/streams/{streamId}/transactions` | Validate và thêm một raw transaction vào stream |
| `DELETE` | `/api/v1/streams/{streamId}/transactions` | Xóa/reset stream và toàn bộ mining session liên quan |
| `POST` | `/api/v1/streams/{streamId}/runs` | Chạy một thuật toán với config được gửi lên |
| `GET` | `/api/v1/streams/{streamId}/results/latest` | Lấy kết quả gần nhất, có thể lọc theo algorithm |
| `POST` | `/api/v1/streams/{streamId}/comparisons` | Chạy CT, DWT và Oracle trên cùng immutable snapshot |

`POST /runs` tạo `MiningSession` mới, chia lại toàn bộ raw transaction thành pane theo config của request rồi phát từng completed pane qua `PanePublisher`. Cách replay này cho phép người dùng đổi config mà không tái sử dụng state CTset/tree cũ. Pane cuối chưa đủ nằm trong buffer và không được publish. Nếu không tạo được first full window, API trả lỗi `WINDOW_NOT_READY`; frontend dùng mã lỗi để hiển thị thông báo, không phân tích chuỗi message.

Ví dụ request chạy một bộ dữ liệu:

```json
{
  "algorithm": "FWUDS_CT",
  "paneSize": 2,
  "windowPaneCount": 2,
  "minWus": 0.5
}
```

Response nên chuẩn hóa pattern theo thứ tự item để so sánh deterministic:

```json
{
  "runId": "run-001",
  "streamId": "stream-001",
  "windowId": 1,
  "algorithm": "FWUDS_CT",
  "patterns": [
    {
      "items": ["A", "C"],
      "wus": 0.7209302326
    }
  ]
}
```

Thứ tự pattern trong response **không được dùng để quyết định correctness** trừ khi đề chấm yêu cầu thứ tự. `ResultComparator` nên canonicalize itemset trước khi so sánh.

Mọi lỗi API dùng một envelope nhất quán:

```json
{
  "code": "WINDOW_NOT_READY",
  "message": "Cửa sổ chưa đủ số pane để khai phá.",
  "fieldErrors": []
}
```

Trong môi trường local, backend cho phép CORS đúng origin của Vite qua configuration. Không dùng wildcard CORS trong cấu hình production.

---

## 9. Oracle Miner - bộ kiểm chứng độc lập

Đây là thành phần bổ sung cho dự án nhằm giảm nguy cơ “hai thuật toán cùng sai”. Nó không thay thế thuật toán bài báo.

### 9.1. Nguyên tắc

Với window nhỏ, Oracle Miner có thể brute-force tất cả non-empty itemsets của tập item trong window:

```text
1. tính TWU từng transaction trực tiếp từ raw transaction;
2. tính sumtwu(window);
3. sinh tất cả non-empty itemsets;
4. với mỗi itemset X:
     - tìm trực tiếp transaction chứa X;
     - tính WUS(X) theo Definition 4;
     - giữ X nếu WUS >= minWus;
5. trả tập FWUP chuẩn tham chiếu.
```

Oracle chậm là chấp nhận được vì chỉ dùng cho test nhỏ.

### 9.2. Quy tắc đối chiếu

Trong compare mode, cùng một completed pane được đưa vào hai session độc lập. Khi cả hai session trả result cho cùng `windowId`, Oracle khai phá immutable snapshot tương ứng:

```text
ctResult  = ctSession.accept(completedPane)
dwtResult = dwtSession.accept(completedPane)

if ctResult và dwtResult đều present:
    snapshot = SlidingWindowManager.currentSnapshot()
    expected = OracleMiner.mine(snapshot)

    canonical(expected.patterns) == canonical(ctResult.patterns)
    canonical(expected.patterns) == canonical(dwtResult.patterns)
```

Ngoài membership của pattern, phải so sánh WUS với tolerance được quy định và kiểm tra ba kết quả có cùng `windowId`. Oracle chỉ đọc raw immutable snapshot, không đọc CTset, tree hoặc WUNList của production miner.

---

## 10. Test Plan bắt buộc

### 10.1. Tầng 1 - Unit test công thức

Phải test riêng:

- `TwuCalculator`;
- `WusCalculator`;
- `sumtwu`;
- điều kiện `wus == minWus` vẫn là FWUP;
- transaction có một item;
- quantity > 1;
- weight thay đổi giữa các batch.

### 10.2. Tầng 2 - Test theo ví dụ của bài báo

Bộ dữ liệu `DSe` trong paper phải được lưu thành fixture cố định, ví dụ:

```text
src/test/resources/paper/dse.json
```

Test phải tách thành hai nhóm, không dùng expected đã làm tròn của nhóm presentation để thay cho expected nội bộ.

**Nhóm A - exact computation/oracle:**

| Checkpoint | Expected nội bộ |
|---|---:|
| `twu(t1)` | `0.475` |
| `twu(t2)` | `0.7` |
| `twu(t3)` | `11/30` |
| `twu(t4)` | `29/30` |
| `twu(t5)` | `13/30` |
| `twu(t6)` | `1.05` |
| `sumtwu(W1)` | `301/120` |
| `wus(AC, W1)` | `31/43` |
| `sumtwu(W2)` | `169/60` |
| `wus(A, W2)` | `11/13` |
| `wus(E, W1)` | `185/301` |
| `wus(EC, W1)` | `185/301` |
| exact `wunl(C)` | `{<1,6,301/120>}` |
| exact `wunl(EC)` | `{<1,6,185/120>}` |

**Nhóm B - cấu trúc và giá trị trình bày trong paper:**

| Checkpoint | Expected |
|---|---|
| `CTset(A, W1)` | `{1,3,4}` |
| `CTset(A, W2)` | `{3,4,2}` theo circular order |
| paper display `twu(t1..t6)` | `0.48, 0.70, 0.37, 0.97, 0.43, 1.05` |
| paper display `sumtwu(W1)` | `2.52` |
| paper display `wus(AC,W1)` | xấp xỉ `0.72` |
| paper display `wus(A,W2)` | xấp xỉ `0.85` |
| `wunl(C)` trong hình paper | `{<1,6,2.52>}` |
| `wus(C)` | `1.0` |
| paper display `wus(E)` | xấp xỉ `0.62` |
| `wunl(EC)` trong hình paper | `{<1,6,1.55>}` |
| paper display `wus(EC)` | xấp xỉ `0.62` |

> **Quan trọng:** WUN-code trong hình paper được tạo từ các TWU đã làm tròn để trình bày. Test nhóm B xác nhận khả năng tái hiện/giải thích ví dụ của paper, nhưng không được làm Oracle cho numeric core. Correctness của thuật toán và threshold membership phải dùng nhóm A cùng Oracle tính từ raw transaction.

### 10.3. Tầng 3 - Test CTset

Phải test:

- `lcTid` tăng bình thường;
- `currentLcTid` khởi tạo bằng `0`;
- `lcTid` quay từ `|W|` về `1`;
- remove oldest pane khi `currentLcTid == |W|`;
- remove oldest pane khi `currentLcTid < |W|`;
- insert pane sau khi remove;
- `twuByLcTid` và `sumTwu` được xóa/thêm đồng bộ với CTset;
- `lcTid` sau wrap-around ánh xạ tới TWU mới, không còn TWU stale;
- CTset giữ đúng chronological circular order;
- intersection khi cả hai lcTid cùng cycle;
- intersection khi nằm ở hai cycle khác nhau;
- intersection rỗng;
- intersection một phần;
- intersection hoàn toàn.

### 10.4. Tầng 4 - Test DSWUN-tree/WUNList

Phải test:

- xây tree từ first window;
- sort item theo WUS giảm dần và tie-break `itemId` tăng dần;
- transaction của pane mới dùng lại tree order đã thiết lập; mining order của `I1` được tính cho current window;
- node weight sau insert;
- `parent` link;
- TAILLIST có đúng một tail entry/transaction;
- mỗi `TailEntry` giữ đúng `transactionId`, `transactionTwu` và `tailNode`;
- update khi pane mới đến;
- giảm weight khi xóa transaction cũ;
- xóa node khi weight trở về zero;
- pre-order/post-order numbering;
- ancestor condition;
- tạo WUNList;
- merge WUN-code có cùng `pre`;
- WUNList intersection;
- hướng descendant/ancestor khi intersect;
- `AW`, `WR1`, `WR2` và early-pruning của Algorithm 6;
- trường hợp non-empty intersection nhưng WUS dưới threshold không được trả thành FWUP;
- tính WUS từ WUNList.

### 10.5. Tầng 5 - Differential test

Sinh nhiều dataset nhỏ deterministic bằng fixed random seed và chạy:

```text
Oracle == FWUDS-CT == FWUDS-DWT
```

Nên thay đổi:

- số item;
- số transaction;
- pane size;
- window size;
- quantity;
- weight;
- minWus;
- sparse/dense transaction.

Khi mismatch, test phải in:

```text
seed
window index
raw transactions
weights
minWus
expected patterns
FWUDS-CT patterns
FWUDS-DWT patterns
missing patterns
unexpected patterns
WUS mismatch
```

Nhờ đó lỗi có thể tái hiện 100%.

### 10.6. Tầng 6 - Edge cases

Tối thiểu phải có:

- pane chưa đủ transaction;
- window đầu tiên chưa đầy;
- pattern chỉ xuất hiện trong pane sắp bị xóa;
- pattern mới xuất hiện trong pane mới;
- item xuất hiện trong mọi transaction;
- item chỉ xuất hiện một lần;
- tất cả item cùng xuất hiện;
- `minWus` rất thấp;
- `minWus = 1`;
- WUS đúng bằng threshold;
- nhiều lần lcTid wrap-around;
- weight thay đổi giữa hai batch;
- pattern dài hơn 2 item;
- dataset có nhiều window liên tiếp.

Expected behavior bắt buộc cho hai case đầu:

- pane chưa đủ: giữ trong buffer, không notify Observer, không mining;
- initial window chưa đủ: session nhận pane nhưng trả `Optional.empty()`;
- pane cuối chưa đủ khi hết file: giữ/loại theo chính sách input đã công bố, mặc định không mining.

Nếu đề chấm quy định khác về input invalid, zero/negative weight, empty transaction hoặc pane cuối không đầy thì quy định chính thức có ưu tiên cao hơn policy MVP ở Section 3.2. Bài báo không nên bị tự diễn giải để tạo thêm quy tắc I/O ngoài những policy đã công bố.

---

## 11. Quy tắc chống sai test

### 11.1. Không tối ưu sớm

Thứ tự triển khai:

```text
Công thức -> Oracle -> FWUDS-CT -> FWUDS-DWT -> Integration -> REST API -> Frontend
```

Chỉ tối ưu sau khi differential test pass.

### 11.2. Không dùng chung logic critical giữa Oracle và thuật toán

Ví dụ:

- Oracle tìm transaction chứa pattern trực tiếp từ raw data.
- FWUDS-CT phải dùng CTset.
- FWUDS-DWT phải dùng DSWUN-tree/WUNList.

Nếu cả ba dùng chung một hàm sai để xác định transaction chứa pattern thì differential testing không còn đáng tin.

### 11.3. Deterministic output

Để test ổn định:

- item trong `Pattern` có canonical ordering;
- `equals/hashCode` của Pattern dựa trên canonical itemset;
- random test luôn có seed;
- không dựa vào iteration order của `HashMap`/`HashSet` cho logic thuật toán;
- nếu thứ tự item là một phần của thuật toán, dùng comparator được định nghĩa rõ ràng và test comparator đó.

### 11.4. Không trộn presentation với computation

Không dùng giá trị `String.format("%.2f", wus)` quay trở lại thuật toán.

```text
Mining core: full precision
API/UI:      format để hiển thị
```

### 11.5. Assertions theo invariant

Ngoài expected output, test các invariant:

```text
0 <= wus(X) <= 1               (với dữ liệu/định nghĩa hợp lệ)
CTset.size <= |W|
lcTid thuộc [1, |W|]
TAILLIST size tương ứng số transaction đang được tree quản lý
mọi non-root DSWUNNode có parent
mọi FWUP trả về có wus >= minWus
```

---

## 12. Luồng hoạt động hệ thống

```text
[Nhận transaction]
       |
       v
[Buffer đến đủ paneSize]
       |
       v
[PanePublisher phát PaneArrivedEvent]          <- Observer
       |
       v
[MiningCoordinator]
       |
       +--> [SlidingWindowManager: immutable snapshot]
       |
       v
[MiningService / MiningSession]                <- Strategy
       |
       +-----------------------+
       |                       |
       v                       v
[FWUDS-CT]               [FWUDS-DWT]
       |                       |
       v                       v
    CTset               DSWUN-tree/WUNList
       |                       |
       +-----------+-----------+
                   |
                   v
             [MiningResult]
                   |
                   v
          [Test Runner / REST API]
```

Trong **test mode**:

```text
                    Current Window
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
       Oracle         FWUDS-CT       FWUDS-DWT
          |              |              |
          +--------------+--------------+
                         |
                         v
                  ResultComparator
                         |
                  PASS / FAIL + diff
```

---

## 13. Domain model tối thiểu

### `TransactionItem`

```text
itemId
quantity
weight (hoặc tham chiếu weight batch bất biến phù hợp input)
```

### `Transaction`

```text
tid
items
twu
```

### `Pane`

```text
paneId
transactions
```

### `SlidingWindow`

```text
windowId
panes
paneSize
windowPaneCount
sumTwu
```

### `Pattern`

```text
items (canonical itemset)
```

### `PatternResult`

```text
pattern
wus
```

### `MiningResult`

```text
windowId
algorithm
patterns
executionTime (optional metric)
```

### `MiningSession` và state nội bộ

```text
MiningSession
- config bất biến
- trạng thái initial-window accumulation
- state gia tăng riêng của một thuật toán
- accept(completedPane) -> Optional<MiningResult>
```

`FWUDSCTSession` sở hữu CTset, `currentLcTid`, `twuByLcTid` và `sumTwu`. `FWUDSDWTSession` sở hữu DSWUN-tree, TAILLIST, comparator/order đã thiết lập và state cần tạo WUNList. Các state này không nằm trong domain object dùng chung và không được khai báo static/global.

---

## 14. Công nghệ đề xuất

### 14.1. Frontend

```text
React 19
TypeScript 5.7+
Vite 8
Tailwind CSS 4
pnpm
```

Đây là stack đang có trong Figma export. Chỉ nâng version khi có nhu cầu rõ ràng và sau khi build/UI regression pass. REST client dùng `fetch` bọc trong một module typed; không cần thêm state-management library cho MVP nếu React state/context đã đủ.

### 14.2. Backend

```text
Java 21 LTS (hoặc phiên bản Java do môn học quy định)
Spring Boot 3.x
Maven Wrapper
JUnit 5
```

Spring Boot cung cấp REST layer nhưng **không phải điều kiện để thuật toán hoạt động**. Core mining là Java thuần để JUnit gọi trực tiếp, chạy nhanh và không cần application context. Database không bắt buộc cho bản đầu; test fixture nằm trong `backend/src/test/resources` để bảo đảm reproducibility.

### 14.3. Lệnh nghiệm thu

```text
cd frontend
pnpm install
pnpm build

cd ../backend
./mvnw clean verify          # macOS/Linux
mvnw.cmd clean verify        # Windows
```

Frontend dev server và backend dùng port cấu hình qua environment/application profile. Chỉ commit file `.env.example`, không commit secret hay file `.env` cá nhân.

---

## 15. Thứ tự triển khai khuyến nghị

### Phase 0 - Chuẩn hóa repository và baseline frontend

- chuyển `Web App for CartLens/` thành `frontend/`;
- tạo Maven Spring Boot project trong `backend/`;
- ghi nhận ảnh/baseline hành vi của năm màn hình trước khi refactor;
- xác nhận `pnpm build` pass sau khi chuyển thư mục;
- thêm root README và cấu hình ignore chung.

**Gate:** repository có `frontend/`, `backend/`, `docs/`; frontend build và hiển thị như bản Figma export.

### Phase 1 - Mathematical Core

- Domain classes.
- TWU.
- WUS.
- Sliding window cơ bản.
- Paper DSe fixture.

**Gate:** toàn bộ unit test công thức pass.

### Phase 2 - Independent Oracle

- brute-force itemset generation;
- direct WUS calculation;
- canonical result comparison.

**Gate:** Oracle khớp exact values tính từ raw `DSe`; presentation test giải thích được các số đã làm tròn trong paper.

### Phase 3 - FWUDS-CT

- lcTid;
- CTset;
- `twuByLcTid` và `sumTwu`;
- pane removal/insertion;
- linear CTset intersection;
- recursive mining.

**Gate:** FWUDS-CT == Oracle trên paper fixture và random small tests.

### Phase 4 - FWUDS-DWT

- DSWUNNode/Tree;
- tree order và mining order;
- InsertTree;
- TailEntry/TAILLIST;
- Update_DSWUN-tree;
- pre/post;
- WUNList;
- WUNList intersection với `AW/WR1/WR2`;
- DFS mining.

**Gate:** FWUDS-DWT == Oracle == FWUDS-CT.

### Phase 5 - Design Patterns

- Strategy để thay thuật toán.
- Observer để xử lý pane arrival.

**Gate:** refactor không làm thay đổi bất kỳ expected mining result nào.

### Phase 6 - REST API và application layer

- in-memory stream store và lifecycle của session;
- request/response DTO, validation và error envelope;
- endpoint transaction, overview, run, latest result và comparison;
- CORS/profile cấu hình cho local development;
- controller/integration tests bằng Spring test support.

**Gate:** API contract tests pass; core tests vẫn pass không cần Spring context.

### Phase 7 - Tích hợp frontend

- tách `App.tsx` theo feature;
- tạo typed API client và environment configuration;
- thay seed/mine/timer mô phỏng bằng backend API;
- nối đủ năm màn hình, bao gồm loading/empty/error;
- kiểm tra responsive và accessibility cơ bản.

**Gate:** toàn bộ user flow từ thêm giao dịch đến xem/so sánh kết quả chạy bằng Java backend; frontend không còn sinh kết quả khai phá giả.

### Phase 8 - Nghiệm thu end-to-end

- chạy frontend build, backend verify và smoke test tích hợp;
- đối chiếu Oracle == FWUDS-CT == FWUDS-DWT;
- cập nhật README hướng dẫn chạy, dữ liệu demo và giới hạn hệ thống.

**Gate:** Definition of Done ở Section 16 được hoàn tất và có bằng chứng test/build.

---

## 16. Definition of Done

Trước khi nộp, project phải đạt checklist sau:

```text
[x] TWU đúng theo Definition 3
[x] WUS đúng theo Definition 4
[x] Sliding window đúng pane/window size
[x] Pane chưa đủ không phát event; initial window chưa đủ không trả result
[x] Weight thay đổi theo input/batch đúng
[x] Exact numeric tests tách khỏi paper display tests
[x] Không round giá trị nội bộ trước threshold comparison
[x] FWUDS-CT đúng lcTid circular rule
[x] FWUDS-CT remove/insert pane đúng thứ tự
[x] twuByLcTid và sumTwu đồng bộ qua nhiều lần wrap-around
[x] CTset intersection đúng circular chronology
[x] FWUDS-CT trả đủ FWUP
[x] DSWUN-tree có đủ 6 trường logic/node
[x] DSWUN transaction/item order và tie-break deterministic
[x] Mỗi TailEntry giữ transactionId, transactionTwu và tailNode đúng
[x] TAILLIST cập nhật đúng
[x] DSWUN-tree update đúng pseudocode
[x] pre/post đúng
[x] WUNList đúng hướng ancestor/descendant và merge cùng pre
[x] WUNList intersection áp dụng nhất quán Contract A của Algorithm 6
[x] FWUDS-DWT trả đủ FWUP
[x] Exact paper-data tests và paper-display tests pass đúng vai trò
[x] Oracle == FWUDS-CT
[x] Oracle == FWUDS-DWT
[x] Differential/random tests pass
[x] Multiple-window/wrap-around tests pass
[x] Mỗi lần chạy dùng MiningSession độc lập, không rò state giữa test
[x] Strategy Pattern có trong production code
[x] Observer Pattern có trong production code
[x] Pattern không làm thay đổi mining logic
[x] Core tests chạy không cần UI/Spring context
[x] Repository có đúng `frontend/`, `backend/` và `docs/`
[x] Figma export được chuyển thành frontend thật, giữ đủ 5 màn hình
[x] Frontend không còn dùng `mine(...)`/`setTimeout` mô phỏng làm nguồn kết quả
[x] REST API `/api/v1` có validation và error envelope nhất quán
[x] Mọi kết quả mining hiển thị trên UI đến từ Java backend
[x] Flow thêm giao dịch -> cấu hình -> chạy -> kết quả -> so sánh hoạt động end-to-end
[x] `pnpm build` thành công trong `frontend/`
[x] `mvnw.cmd clean verify` hoặc `./mvnw clean verify` thành công trong `backend/`
```

---

## 17. Truy vết yêu cầu giữa hai môn

| Yêu cầu | Java nâng cao | Mẫu thiết kế | Bản demo tích hợp |
|---|---:|---:|---:|
| Java backend | ✓ | ✓ | ✓ |
| TWU/WUS | ✓ |  | ✓ |
| Sliding window | ✓ |  | ✓ |
| FWUDS-CT | ✓ |  | ✓ |
| FWUDS-DWT | ✓ |  | ✓ |
| CTset/DSWUN-tree/WUNList | ✓ |  |  |
| Unit + differential testing | ✓ |  |  |
| Strategy |  | ✓ |  |
| Observer |  | ✓ |  |
| REST API | hỗ trợ | hỗ trợ | ✓ |
| React UI từ Figma |  |  | ✓ |

Thiết kế này giữ **algorithm core** là trọng tâm của môn Java nâng cao, còn hai Design Pattern nằm ở lớp kiến trúc phù hợp với bản chất hệ thống. Hai phần không được trộn vào nhau theo cách làm sai thuật toán.

---

## 18. Nguồn chuẩn và thứ tự ưu tiên khi có mâu thuẫn

Khi triển khai, dùng thứ tự ưu tiên sau:

1. **Đặc tả test/I-O chính thức của giảng viên** (nếu có).
2. **Pseudocode, definition, theorem và example trong bài báo được giao.**
3. Bản đặc tả này.
4. Quyết định kỹ thuật của nhóm.

Trong chính paper, nếu giá trị ví dụ đã làm tròn khác với kết quả tính từ Definition và raw transaction, dùng **Definition + raw transaction** cho numeric core/Oracle; dùng giá trị làm tròn chỉ cho presentation test. File text trích xuất từ PDF chỉ được dùng để tìm kiếm, không được dùng thay cho công thức, bảng hoặc pseudocode đã kiểm tra trực tiếp trên PDF gốc.

Các phần của paper cần đối chiếu trực tiếp khi code:

- Section 3.1: problem definition, sliding window, TWU, WUS.
- Section 3.2: Tidset.
- Section 3.3: WUNList.
- Section 3.4: overall update-then-mine framework.
- Section 4: CTset, lcTid, CTset maintenance/intersection, FWUDS-CT.
- Section 5: DSWUN-tree, TAILLIST, tree update, WUNList mining, FWUDS-DWT.
- Section 6: evaluation methodology.
- Section 7: complexity/discussion.

> Nếu code và tài liệu thiết kế mâu thuẫn với paper ở phần thuật toán, **sửa code/tài liệu thiết kế theo paper**, không sửa thuật toán để khớp kiến trúc phần mềm.

---

## 19. Kết luận thiết kế

Phiên bản nộp bài nên là một hệ thống nhỏ nhưng kiểm chứng chặt:

```text
React UI -> Java REST API -> Real-time Basket Stream
                            -> Pane-based Sliding Window
                            -> FWUDS-CT / FWUDS-DWT
                            -> FWUP Results
                            -> Differential Verification
```

Chỉ sử dụng **Strategy** và **Observer** làm hai Design Pattern chính. Đây là mức tối thiểu đáp ứng yêu cầu môn Mẫu thiết kế mà vẫn giữ kiến trúc dễ kiểm tra. React frontend là lớp tương tác và trình bày; Java backend là nguồn sự thật cho mining. Trọng tâm kỹ thuật vẫn là tái hiện chính xác FWUDS-CT và FWUDS-DWT theo bài báo, với Oracle Miner và differential testing đóng vai trò hàng rào kiểm chứng trước khi nộp.
