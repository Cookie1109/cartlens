# KẾ HOẠCH TRIỂN KHAI CARTLENS

> **Cập nhật 08/10/2026:** lifecycle MVP replay/in-memory bên dưới đã được thay bằng session liên tục và archive H2 theo yêu cầu xử lý Chainstore. Hành vi hiện hành và bằng chứng kiểm chứng nằm trong `README.md` và `docs/reviews/FWUP_STREAMING_COMPLETION.md`. MiningService dùng cho test/reference vẫn tạo session độc lập.
> **Spec nguồn:** `docs/specs/HE_THONG_PHAN_TICH_GIO_HANG_FWUP_SPEC.md`
>
> **Frontend nguồn:** `Web App for CartLens/` (Figma export)
>
> **Kiến trúc đích:** `frontend/` (React) + `backend/` (Java)
>
> **Nguyên tắc:** correctness của thuật toán trước, tích hợp theo contract, không để frontend tự sinh kết quả mining.

---

## 1. Mục tiêu bàn giao

Hệ thống hoàn chỉnh phải cho phép người dùng:

1. xem trạng thái luồng giao dịch và sliding window;
2. xem, thêm và reset giao dịch;
3. cấu hình `paneSize`, `windowPaneCount`, `minWus` và chọn thuật toán;
4. chạy FWUDS-CT hoặc FWUDS-DWT trên Java backend;
5. xem danh sách FWUP, WUS, support và transaction liên quan;
6. chạy so sánh FWUDS-CT, FWUDS-DWT và Oracle trên cùng dữ liệu;
7. tái hiện kết quả bằng test tự động và build được cả hai application.

Kết quả mining từ Java backend là nguồn sự thật duy nhất. UI hiện tại được giữ làm baseline về giao diện và user flow, không phải baseline về tính đúng của thuật toán.

---

## 2. Quyết định kiến trúc

| Hạng mục | Quyết định |
|---|---|
| Repository | Hai application folder `frontend/`, `backend/`; tài liệu ở `docs/` |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS theo Figma export |
| Backend | Java 21, Spring Boot 3.x, Maven Wrapper, JUnit 5 |
| Mining core | Java thuần, không phụ thuộc Spring/HTTP/database |
| API | REST JSON, prefix `/api/v1`, DTO tách khỏi domain model |
| Runtime data | In-memory theo `streamId` cho bản demo; không cần database |
| Số học | `BigDecimal` + `MathContext.DECIMAL128`; không round trong mining core |
| Design Pattern | Strategy cho thuật toán, Observer cho pane arrival |
| Verification | Oracle độc lập + differential test giữa ba miner |
| Frontend state | React state/context là mặc định; chỉ thêm library khi có nhu cầu thực tế |
| API client | Typed wrapper trên `fetch`, base URL từ `VITE_API_BASE_URL` |

### 2.1. Lifecycle dữ liệu được chọn

- Stream lưu raw transaction theo thứ tự thời gian.
- Cấu hình mining thuộc một lần chạy.
- Mỗi lần chạy tạo session mới và phát lại raw transaction qua `PanePublisher` theo `paneSize` của request.
- Chỉ pane đủ kích thước được publish; phần dư ở cuối nằm trong buffer và không được mining.
- Thay đổi config không sửa session cũ; nó tạo run/session mới, tránh state CTset/tree bị nhiễm.
- Kết quả và comparison gắn với `runId`, `streamId`, config và immutable window snapshot.

Cách này phù hợp với UI hiện tại: người dùng nhập dữ liệu, cấu hình rồi chủ động bấm chạy. Nó cũng giữ mỗi execution deterministic và dễ test.

---

## 3. Cấu trúc thư mục đích

```text
CartLens/
|-- frontend/
|   |-- src/
|   |   |-- app/
|   |   |-- components/
|   |   |-- features/
|   |   |   |-- overview/
|   |   |   |-- transactions/
|   |   |   |-- mining/
|   |   |   |-- results/
|   |   |   +-- comparison/
|   |   |-- services/
|   |   |   |-- apiClient.ts
|   |   |   +-- cartLensApi.ts
|   |   +-- types/
|   |-- .env.example
|   |-- package.json
|   +-- vite.config.ts
|
|-- backend/
|   |-- .mvn/
|   |-- src/
|   |   |-- main/java/com/cartlens/
|   |   |   |-- api/
|   |   |   |-- application/
|   |   |   |-- domain/
|   |   |   |-- infrastructure/
|   |   |   |-- mining/
|   |   |   |   |-- ct/
|   |   |   |   +-- dwt/
|   |   |   |-- service/
|   |   |   |-- verification/
|   |   |   +-- window/
|   |   +-- test/
|   |       |-- java/com/cartlens/
|   |       +-- resources/paper/
|   |-- mvnw
|   |-- mvnw.cmd
|   +-- pom.xml
|
|-- docs/
|   |-- plans/
|   +-- specs/
|
|-- .gitignore
+-- README.md
```

---

## 4. Contract frontend/backend

### 4.1. Endpoint MVP

| Màn hình | Endpoint | Ghi chú |
|---|---|---|
| Khởi tạo app | `POST /api/v1/streams` | Tạo phiên in-memory, trả `streamId` |
| Tổng quan | `GET /api/v1/streams/{streamId}/overview` | Thống kê transaction, pane và run gần nhất |
| Giao dịch | `GET /api/v1/streams/{streamId}/transactions` | Có thể phân trang/lọc ở frontend trong MVP |
| Giao dịch | `POST /api/v1/streams/{streamId}/transactions` | Validate ID, item, quantity, weight |
| Giao dịch | `DELETE /api/v1/streams/{streamId}/transactions` | Reset raw data, run và result của stream |
| Khai phá | `POST /api/v1/streams/{streamId}/runs` | Body gồm algorithm và mining config |
| Kết quả | `GET /api/v1/streams/{streamId}/results/latest` | Hỗ trợ query `algorithm` |
| So sánh | `POST /api/v1/streams/{streamId}/comparisons` | Chạy ba miner trên cùng snapshot |

### 4.2. DTO cốt lõi

```text
TransactionRequest
- id: string
- items: [{ itemId, name, quantity, weight }]

MiningRunRequest
- algorithm: FWUDS_CT | FWUDS_DWT
- paneSize: integer > 0
- windowPaneCount: integer > 0
- minWus: decimal trong [0, 1]

MiningRunResponse
- runId
- streamId
- algorithm
- config
- windowId
- windowTransactionCount
- patterns[]
- executionTimeMs

PatternResponse
- items[] theo canonical order
- wus ở full precision
- support
- transactionIds[]

ComparisonResponse
- config
- oracle
- fwudsCt
- fwudsDwt
- equivalent
- differences[]
```

### 4.3. Mã lỗi ổn định cho UI

Tối thiểu gồm:

- `VALIDATION_ERROR`;
- `STREAM_NOT_FOUND`;
- `DUPLICATE_TRANSACTION_ID`;
- `WINDOW_NOT_READY`;
- `MINING_FAILED`;
- `RESULT_NOT_FOUND`;
- `COMPARISON_MISMATCH`.

Frontend quyết định thông báo dựa trên `code` và `fieldErrors`, không parse chuỗi exception Java.

---

## 5. Kế hoạch theo phase

### Phase 0 - Chốt baseline và tách repository

#### Công việc

- [x] Chạy `pnpm build` trong `Web App for CartLens/` để có baseline.
- [x] Ghi lại năm màn hình, các empty/loading/success/error state và user flow hiện có.
- [x] Chuyển `Web App for CartLens/` thành `frontend/`.
- [x] Giữ các file Figma cần cho build; chỉ bỏ plugin/scaffold Figma sau khi xác nhận không còn cần.
- [x] Tạo `backend/` bằng Spring Boot + Maven Wrapper.
- [x] Thêm `.gitignore`, root `README.md`, `frontend/.env.example`.
- [x] Xác nhận frontend vẫn build và render như trước khi chuyển.

> Hoàn tất ngày 06/10/2026. Figma export ban đầu không build được vì thiếu `.figma/make/site.json`; chi tiết và phạm vi scaffold đã loại bỏ được ghi tại `PHASE_0_UI_BASELINE.md`.

#### Exit criteria

- Root có `frontend/`, `backend/`, `docs/`.
- `frontend/` build pass, không có thay đổi giao diện ngoài ý muốn.
- `backend/` khởi động và health/smoke endpoint trả thành công.

### Phase 1 - Mathematical core và domain

#### Công việc

- [x] Tạo immutable domain model: transaction item, transaction, pane, window, pattern, config, result.
- [x] Implement input validation và canonical item ordering.
- [x] Implement `TwuCalculator`, `WusCalculator`, `sumTwu` bằng `BigDecimal`.
- [x] Implement pane buffer và immutable sliding-window snapshot.
- [x] Chuyển DSe paper thành fixture trong `backend/src/test/resources/paper/dse.json`.
- [x] Viết exact numeric tests và paper-display tests riêng biệt.

#### Exit criteria

- Các checkpoint ở Sections 3 và 10 của SPEC pass.
- Không có formatting/rounding quay lại mining computation.
- Core tests chạy không cần Spring context.

### Phase 2 - Oracle Miner độc lập

#### Công việc

- [x] Sinh tất cả non-empty itemset cho window nhỏ.
- [x] Tìm transaction chứa itemset trực tiếp từ raw snapshot.
- [x] Tính WUS và lọc threshold độc lập với production miner.
- [x] Implement canonical `ResultComparator` và diff dễ đọc.
- [x] Thêm test boundary `wus == minWus`.

#### Exit criteria

- Oracle khớp exact values của paper fixture.
- Mismatch report có đủ input, config, window và differences.

### Phase 3 - FWUDS-CT

#### Công việc

- [x] Implement `CircularTidset`, `CTsetStore`, `twuByLcTid`, `sumTwu`.
- [x] Implement cấp và wrap `lcTid`.
- [x] Implement remove-oldest rồi insert-new đúng Algorithm 1.
- [x] Implement linear CTset intersection theo circular chronology.
- [x] Implement recursive equivalent-class mining.
- [x] Test nhiều lần wrap-around và stale TWU.

#### Exit criteria

- `FWUDS-CT == Oracle` trên DSe và random small datasets.
- Toàn bộ invariant CTset trong SPEC pass.

### Phase 4 - FWUDS-DWT

#### Công việc

- [x] Implement node/tree, parent link và deterministic tree order.
- [x] Implement `TailEntry`/`TAILLIST` với một entry cho mỗi transaction.
- [x] Implement insert-new rồi remove-oldest theo Algorithm 5.
- [x] Implement pre/post traversal, WUN-code và WUNList.
- [x] Implement intersection Contract A với `AW`, `WR1`, `WR2`.
- [x] Implement DFS mining và current-window mining order.

#### Exit criteria

- `FWUDS-DWT == Oracle == FWUDS-CT` trên fixtures và random tests.
- Các test tree update, delete-to-zero, ancestor direction và pruning pass.

### Phase 5 - Strategy, Observer và application service

#### Công việc

- [x] Tạo `MiningStrategy` và stateful `MiningSession` cho từng algorithm.
- [x] Tạo `PanePublisher`, `PaneObserver`, `MiningCoordinator`.
- [x] Mỗi run tạo session mới; không dùng static mutable state.
- [x] Compare mode dùng cùng immutable snapshot nhưng ba execution độc lập.
- [x] Bảo đảm pane cuối chưa đủ không phát event.

#### Exit criteria

- Refactor không làm thay đổi expected mining result.
- Test chứng minh không rò state giữa hai run/config/algorithm.

### Phase 6 - REST API

#### Công việc

- [x] Implement in-memory stream repository có lifecycle rõ ràng.
- [x] Implement DTO mapping và Bean Validation ở API boundary.
- [x] Implement endpoint theo Section 4.1.
- [x] Implement global exception handler và error envelope.
- [x] Cấu hình CORS bằng property/profile.
- [x] Viết controller tests cho happy path và validation/error path.
- [x] Viết API integration test cho flow tạo stream -> thêm transaction -> run -> result -> compare.

#### Exit criteria

- API trả cùng kết quả với Java service tests.
- Không expose CTset, tree node, WUNList hoặc Java exception stack trace.
- `mvnw.cmd clean verify`/`./mvnw clean verify` pass.

### Phase 7 - Refactor frontend theo feature

#### Công việc

- [x] Di chuyển type dùng chung khỏi `App.tsx`.
- [x] Tách layout/navigation và primitive UI dùng chung.
- [x] Tách năm feature page theo cấu trúc đích.
- [x] Tạo `apiClient`, response guards tối thiểu và algorithm adapter.
- [x] Tạo state quản lý `streamId`, config, last result và request status.
- [x] Giữ nguyên visual baseline trong quá trình tách.

#### Exit criteria

- `App.tsx` chỉ còn composition/routing cấp ứng dụng.
- Không duplicate API mapping hoặc algorithm enum trong nhiều feature.
- Frontend build pass sau mỗi lát cắt refactor.

### Phase 8 - Nối UI với Java backend

#### Công việc

- [x] App startup tạo/khôi phục `streamId` phù hợp policy phiên demo.
- [x] Trang Giao dịch đọc/thêm/reset qua API.
- [x] Trang Khai phá gửi config và algorithm qua API.
- [x] Trang Kết quả render `MiningRunResponse`.
- [x] Trang So sánh render equivalence/differences từ `ComparisonResponse`.
- [x] Trang Tổng quan đọc trạng thái backend, không tự suy diễn mining state.
- [x] Xóa `seedTransactions`, hàm `mine` và `setTimeout` mô phỏng khỏi production path.
- [x] Hoàn thiện loading, empty, validation và retry/error states.

#### Exit criteria

- User flow đầy đủ chạy qua HTTP tới Java backend.
- Network failure không làm mất dữ liệu form chưa submit và có thông báo rõ ràng.
- Không còn code frontend quyết định FWUP hoặc WUS.

### Phase 9 - Nghiệm thu và tài liệu

#### Công việc

- [x] Chạy unit, differential, controller và integration tests.
- [x] Chạy frontend production build.
- [x] Smoke test hai thuật toán với DSe và ít nhất một dataset demo khác.
- [x] Kiểm tra responsive ở desktop/tablet và keyboard focus cơ bản.
- [x] Cập nhật root README: prerequisites, commands, ports, env và demo flow.
- [x] Ghi rõ giới hạn: in-memory, single-process, pane cuối chưa đủ, không auth/database.

> Hoàn tất ngày 06/10/2026. Nghiệm thu: 19 backend tests, frontend production build và browser smoke flow DSe đều pass.

#### Exit criteria

- Toàn bộ Definition of Done trong SPEC được tick.
- Một máy mới có thể chạy dự án theo README mà không cần đoán cấu hình.

---

## 6. Chiến lược kiểm thử

| Tầng | Phạm vi | Công cụ/Gate |
|---|---|---|
| Unit | TWU, WUS, window, CTset, tree, WUNList | JUnit 5; nhanh, không Spring |
| Oracle | Brute-force từ raw snapshot | Exact paper fixture |
| Differential | Oracle vs CT vs DWT | Fixed seeds, mismatch report đầy đủ |
| Application | Strategy, Observer, session isolation | JUnit 5 |
| API slice | DTO, validation, status code, error envelope | Spring MVC test support |
| Integration | Full API flow với in-memory store | Spring Boot test |
| Frontend build | Type checking/bundle | `pnpm build` |
| End-to-end smoke | User flow qua frontend/backend | Checklist hoặc browser automation khi ổn định |

Quy tắc merge: phase thuật toán không được qua gate chỉ nhờ hai production miner khớp nhau; cả hai phải khớp Oracle độc lập.

---

## 7. Rủi ro và biện pháp giảm thiểu

| Rủi ro | Ảnh hưởng | Biện pháp |
|---|---|---|
| Giá trị paper đã làm tròn khác exact value | Sai threshold/membership | Tách exact tests và presentation tests |
| Oracle dùng chung logic sai với production | Differential test cho kết quả giả | Oracle chỉ đọc raw snapshot, không dùng CTset/tree/WUNList |
| `App.tsx` tiếp tục phình to | Khó tích hợp và test | Refactor theo feature trước khi nối toàn bộ API |
| Thay UI khi di chuyển Figma export | Mất baseline đã duyệt | Build/snapshot/smoke trước và sau mỗi lát cắt |
| Config mới tái sử dụng session cũ | State CTset/tree không hợp lệ | Mỗi run tạo session mới và replay raw transactions |
| Hai thuật toán chạy trên snapshot khác nhau | So sánh vô nghĩa | Comparison service đóng băng một snapshot và config |
| API trả domain nội bộ | Coupling và lộ implementation | DTO mapper tại application/API boundary |
| In-memory store tăng không giới hạn | Tốn RAM khi demo lâu | Reset endpoint; có thể thêm TTL/limit sau MVP |
| CORS/URL hard-code | Chạy khác máy thất bại | Cấu hình bằng profile và `VITE_API_BASE_URL` |

---

## 8. Thứ tự ưu tiên khi thời gian hạn chế

1. Mathematical core + Oracle.
2. FWUDS-CT và differential tests.
3. FWUDS-DWT và differential tests.
4. Strategy/Observer đúng vai trò.
5. REST API cho run/result/compare.
6. Nối năm màn hình Figma với API.
7. Refactor/UX bổ sung và tối ưu hiệu năng.

Không cắt Oracle, exact numeric tests hoặc session isolation để dành thời gian cho hiệu ứng UI.

---

## 9. Checklist release

```text
[x] frontend/ và backend/ tồn tại đúng cấu trúc
[x] frontend không có mining result giả trong production path
[x] backend core không phụ thuộc Spring
[x] Oracle == FWUDS-CT == FWUDS-DWT
[x] boundary wus == minWus pass
[x] nhiều window và lcTid wrap-around pass
[x] API validation/error contract pass
[x] flow transaction -> run -> result -> compare pass
[x] frontend pnpm build pass
[x] backend Maven verify pass
[x] README đủ để setup và demo
```
