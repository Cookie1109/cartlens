# CartLens

CartLens khai phá Frequent Weighted Utility Patterns (FWUP) trên luồng giao dịch bằng hai thuật toán FWUDS-CT và FWUDS-DWT. Java backend là nguồn sự thật duy nhất cho TWU, WUS và tập pattern; React frontend chỉ nhập dữ liệu, gửi cấu hình và hiển thị response.

## Kiến trúc

- `frontend/`: React 19, TypeScript, Vite, Tailwind CSS; gồm 5 màn hình Tổng quan, Giao dịch, Khai phá, Kết quả và So sánh.
- `backend/`: Java 21, Spring Boot 3.5, Maven Wrapper; mining core Java thuần tách khỏi Spring.
- `backend/src/test/resources/paper/dse.json`: fixture DSe từ bài báo.
- `docs/`: đặc tả, implementation plan và UI baseline.

Mỗi lần chạy tạo một `MiningSession` mới và phát lại raw transactions qua các pane hoàn chỉnh. Strategy chọn CT/DWT; Observer phát pane; Oracle brute-force độc lập dùng cho differential verification.

## Yêu cầu

- Node.js 22 và Corepack.
- JDK 21 trở lên.
- Không cần cài Maven hoặc pnpm toàn cục.

## Chạy ứng dụng

Mở terminal thứ nhất:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Trên macOS/Linux dùng `./mvnw spring-boot:run`. Backend mặc định ở `http://localhost:8080`.

Mở terminal thứ hai:

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Frontend mặc định ở `http://localhost:5173`.

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | REST base URL cho frontend; xem `frontend/.env.example` |
| `CARTLENS_CORS_ALLOWED_ORIGIN` | `http://localhost:5173` | Origin được backend cho phép |

Nếu mở frontend bằng hostname/origin khác, đặt cả hai biến cho khớp trước khi khởi động.

## Demo DSe

1. Mở **Giao dịch** và chọn **Nạp DSe**.
2. Mở **Khai phá**, giữ `paneSize=2`, `windowPaneCount=2`, `minWus=0.5`.
3. Chọn FWUDS-CT hoặc FWUDS-DWT rồi chạy.
4. Xem WUS, support và transaction IDs ở **Kết quả**.
5. Mở **So sánh** và chạy đối chiếu; UI phải báo Oracle, FWUDS-CT và FWUDS-DWT tương đương.

## REST API

Tất cả endpoint nghiệp vụ có prefix `/api/v1`:

| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/streams` | Tạo stream in-memory |
| `GET` | `/streams/{id}/overview` | Trạng thái stream và run gần nhất |
| `GET/POST/DELETE` | `/streams/{id}/transactions` | Đọc, thêm hoặc reset giao dịch |
| `POST` | `/streams/{id}/runs` | Chạy FWUDS-CT/FWUDS-DWT |
| `GET` | `/streams/{id}/results/latest` | Lấy kết quả gần nhất |
| `POST` | `/streams/{id}/comparisons` | Chạy Oracle, CT và DWT trên cùng snapshot |

Health endpoints: `GET /api/v1/health` và `GET /actuator/health`. Lỗi API luôn dùng envelope ổn định gồm `code`, `message`, `fieldErrors`.

## Kiểm thử và build

```powershell
cd backend
.\mvnw.cmd clean verify

cd ..\frontend
corepack pnpm build
```

Backend suite gồm exact/presentation numeric tests, CTset và DSWUN-tree invariants, boundary threshold, multi-window wrap-around, 30 fixed random differential datasets và full REST integration flow.

## Giới hạn MVP

- Dữ liệu chỉ nằm trong RAM, single-process; restart backend sẽ mất stream.
- Không có authentication, authorization hoặc database.
- Pane cuối chưa đủ `paneSize` được giữ ở buffer và không được mining.
- Stream không có TTL/size limit; dùng Reset trong phiên demo dài.
- Mining tối ưu cho correctness/demo dataset, chưa benchmark cho production-scale stream.

Chi tiết quyết định và checklist nằm trong [implementation plan](docs/plans/CARTLENS_IMPLEMENTATION_PLAN.md); UI gốc được ghi tại [baseline](docs/plans/PHASE_0_UI_BASELINE.md).
