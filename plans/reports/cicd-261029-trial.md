# Báo cáo: chạy thử CI/CD — 29/10/2026

- Repo (private): https://github.com/Gachienmam88/vaxclinic-kiotviet (nhánh mặc định `main`, nhánh dev `feature/phase-01-foundation`)
- Actions: https://github.com/Gachienmam88/vaxclinic-kiotviet/actions
- Hướng dẫn đầy đủ cho chủ doanh nghiệp + kỹ thuật: `docs/deployment-guide.md`

## 1. Tóm tắt cho chủ doanh nghiệp

Từ nay mỗi lần lập trình viên đẩy code lên GitHub:
1. **CI kiểm tra tự động** (~3–6 phút): biên dịch + test backend Java, kiểm tra kiểu/lint/test/build frontend. Lỗi → báo đỏ, dừng.
2. **Khi code vào nhánh `main`**: CD chạy lại CI, đạt thì **đóng gói 6 Docker image** (5 service + web) lên kho riêng GHCR, gắn mã commit.
3. **Triển khai lên máy chủ**: đã viết sẵn (sao lưu DB → cập nhật → kiểm tra sức khỏe → tự quay lại bản cũ nếu lỗi),
   **hiện tự bỏ qua** vì chưa có máy chủ. Khi có VPS chỉ cần thêm 3 secret (xem `docs/deployment-guide.md` mục 3).

```
dev ──push──▶ GitHub ──▶ CI kiểm tra ──đạt + main──▶ CD đóng gói image (GHCR)
                              │ lỗi                         │
                              ▼                             ▼ (khi có máy chủ)
                          báo đỏ, dừng        SSH → sao lưu DB → pull + up → health check
                                                             ├─ ổn  → ghi nhận bản mới
                                                             └─ lỗi → tự quay lại bản cũ
```

```mermaid
flowchart LR
  A[Dev push] --> B[GitHub]
  B --> C{CI}
  C -- lỗi --> X[Dừng]
  C -- đạt, main --> D[CD: 6 image lên GHCR]
  D --> E{Có máy chủ?}
  E -- chưa --> S[Bỏ qua deploy]
  E -- có --> F[Sao lưu DB] --> G[Cập nhật] --> H{Health check}
  H -- ổn --> OK[Xong]
  H -- lỗi --> R[Rollback bản cũ]
```

## 2. Kết quả chạy thử

RUN_RESULTS_PLACEHOLDER

## 3. Việc đã làm

- **An toàn trước khi push**: quét toàn bộ working tree (921 file) + toàn bộ lịch sử (1.633 blob) — không giá trị nào của
  `.env` (DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, ENCRYPTION_KEY, RABBITMQ/MINIO_PASSWORD) xuất hiện; không có token GitHub/AWS/
  Slack/private key. `.gitignore` bổ sung: `.env.*` (trừ `.env.example`), `frontend/.env*`, `coverage/`, `*.dump`, `*.sql.gz`,
  `*.tsbuildinfo`, `new prompt/` (thư mục rỗng). `backups/`, `target/`, `node_modules/`, `.next/`, `*.log` đã có.
- **Repo private** tạo bằng `gh repo create`, push nhánh dev + `main`.
- **Snapshot working tree**: HEAD trước đó thiếu cả `frontend/package.json`, nhiều module/migration backend (hook auto-commit
  chỉ ghi từng file sửa bằng Edit) → đã `git add -A` để CI build đúng code thật.
- File mới (không đụng code ứng dụng):

| File | Nội dung |
|---|---|
| `.github/workflows/ci.yml` | backend `mvn -B -ntp verify` (Temurin 17, cache Maven); frontend Node 22 + npm 11.6.2: `npm ci`, `tsc --noEmit`, `eslint . --quiet`, `node --experimental-strip-types --test`, `next build`; artifact báo cáo test; concurrency theo nhánh; tái sử dụng được (`workflow_call`) |
| `.github/workflows/cd.yml` | push `main`/bấm tay → CI → build 6 image matrix (buildx + cache GHA) → `ghcr.io/gachienmam88/vaxclinic-kiotviet-<svc>:<sha>` + `:main` → job deploy (environment `production`), tự skip nếu thiếu secret; bấm tay với `tag` = rollback thủ công |
| `infra/deploy/docker-compose.prod.yml` | Postgres 16 + 5 service + frontend, image GHCR, env từ `.env` trên máy chủ, mem_limit 512m/JVM (`-Xmx256m -XX:+UseSerialGC`, gateway 384m/`-Xmx192m`), cổng chỉ 127.0.0.1 |
| `infra/deploy/deploy.sh` | flock chống chạy trùng; `pg_dump -Fc` từng DB + globals, giữ 20 bản; pull + up; chờ `/actuator/health` x5 + `/login`; ghi `.current_tag`/`.previous_tag`; lỗi → rollback tag trước |
| `frontend/Dockerfile`, `frontend/.dockerignore` | multi-stage, user `node`, `next start -p 3000`, `NEXT_PUBLIC_*` qua build-arg |
| `backend/.dockerignore`, `.gitattributes` | bỏ `target/` khỏi build context; ép LF cho `*.sh`, `*.yml`, Dockerfile |
| `docs/deployment-guide.md` | giải thích cho chủ DN + hướng dẫn thêm VPS, secrets, Caddy HTTPS, khôi phục backup, chi phí |

Backend test chỉ là JUnit thuần (không `@SpringBootTest`/Testcontainers) → CI không cần Postgres.
Redis/RabbitMQ/MinIO có trong compose dev nhưng code chưa dùng → không đưa vào prod (tiết kiệm RAM).

## 4. Sự cố gặp khi chạy thử & cách xử lý

| Sự cố | Nguyên nhân | Xử lý |
|---|---|---|
| Workflow không chạy ở lần push đầu | push khởi tạo ~1.070 commit không sinh sự kiện workflow | push commit kế tiếp → workflow được đăng ký |
| `npm ci`: "Missing @emnapi/runtime from lock file" | lockfile do npm 11.6.2 (máy dev) tạo; Node 22 kèm npm 10 đọc khác | CI + Dockerfile cài `npm@11.6.2` trước `npm ci` (không sửa lockfile) |
| Maven 403 từ Maven Central (1 lần) | lỗi tạm thời phía runner/repo | chạy lại là qua |
| Commit snapshot bị gộp vào commit hook `auto: update login-language-select.tsx` | hook auto-commit chạy đúng lúc index đã stage | nội dung đúng; không rewrite history vì hook vẫn đang commit liên tục |

## 5. Việc còn lại / cần quyết định

- Cung cấp VPS (gợi ý 4 GB RAM) + tên miền → thêm secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (+ `DEPLOY_KNOWN_HOSTS`).
- Bật "Required reviewers" cho environment `production` nếu muốn duyệt tay trước khi lên máy chủ.
- Quy trình làm việc: hiện code chỉ lên GitHub khi có người `git push` (repo chưa có push tự động). Nên thống nhất: làm trên
  nhánh → mở PR vào `main` → CI xanh mới merge.
- Annotation GitHub: action v4 (checkout/setup-node/upload-artifact) đang chạy trên Node 20 đã deprecated — nâng lên v5 khi tiện.

## Câu hỏi chưa giải quyết

- Ai là người được duyệt deploy production?
- Dùng VPS nhà cung cấp nào / tên miền nào? Có cần sao lưu ra ngoài máy chủ (Google Drive/S3) hằng ngày không?
- Có muốn bảo vệ nhánh `main` (bắt buộc PR + CI xanh)? (Branch protection trên repo private cần gói GitHub Pro/Team.)
