-- Tìm kiếm không phân biệt dấu ("vac xin" ra "Vắc xin", "duong" ra "Đường" — unaccent đổi đ/Đ thành d/D).
-- unaccent() chỉ STABLE (phụ thuộc từ điển) nên không dùng được trong chỉ mục → bọc bằng hàm IMMUTABLE, gọi từ điển
-- tường minh. Câu truy vấn so sánh immutable_unaccent(lower(cột)) LIKE immutable_unaccent(lower(:q)) — đúng biểu thức
-- của chỉ mục GIN trigram bên dưới (pg_trgm hỗ trợ LIKE '%q%'). Cả 2 extension có sẵn trong postgres (contrib).
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE INDEX idx_users_full_name_unaccent ON users USING gin (public.immutable_unaccent(lower(full_name)) public.gin_trgm_ops);
CREATE INDEX idx_hr_employees_name_unaccent ON hr_employees USING gin (public.immutable_unaccent(lower(name)) public.gin_trgm_ops);
