"""Demo Kafka: nhập hàng trả tiền NCC -> phiếu chi tự vào Sổ quỹ. Gọi qua gateway như frontend."""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

GW = "http://localhost:8080"
BRANCH = "00000000-0000-0000-0000-000000000001"


def call(method, path, body=None, token=None):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(GW + path, data=data, method=method)
    req.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8")
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "null")


def login():
    return call("POST", "/api/auth/login", {"username": "admin", "password": "Admin@12345"})[1]["accessToken"]


def docker(*args):
    subprocess.run(["docker", *args], check=True, capture_output=True)


def backlog(topic="cashflow.events", group="sales-cashbook"):
    """Số bản tin trong topic mà nhóm đọc chưa xử lý = offset cuối - offset đã commit (partition chưa commit = 0)."""
    run = lambda *a: subprocess.run(["docker", "exec", "vaxclinic-kiotviet-kafka-1", *a], capture_output=True, text=True).stdout
    ends = {}
    for line in run("/opt/kafka/bin/kafka-get-offsets.sh", "--bootstrap-server", "localhost:9092", "--topic", topic).split():
        _, part, end = line.split(":")
        ends[part] = int(end)
    committed = {}
    for cols in (l.split() for l in run("/opt/kafka/bin/kafka-consumer-groups.sh", "--bootstrap-server", "localhost:9092",
                                         "--describe", "--group", group).splitlines()):
        if len(cols) > 3 and cols[1] == topic and cols[3].isdigit():
            committed[cols[2]] = int(cols[3])
    return sum(end - committed.get(part, 0) for part, end in ends.items())


def cashbook_rows(token, code):
    _, page = call("GET", "/api/cashbook?size=50", token=token)
    return [v for v in page["items"] if v.get("code") == code]


def wait_voucher(token, code, status=None, timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            rows = cashbook_rows(token, code)
        except Exception:
            rows = []
        if rows and (status is None or rows[0].get("status") == status):
            return rows[0], time.time() - t0
        time.sleep(1)
    return None, time.time() - t0


def setup(token):
    """Nhóm hàng, NCC, sản phẩm demo (tạo nếu chưa có)."""
    _, cats = call("GET", "/api/categories", token=token)
    cat = next((c for c in cats if c["name"] == "Vắc xin"), None) or call("POST", "/api/categories", {"name": "Vắc xin"}, token)[1]
    _, sups = call("GET", "/api/suppliers?q=ABC", token=token)
    sup = next((s for s in sups["items"] if s["name"] == "Công ty Vắc xin ABC"), None) or \
        call("POST", "/api/suppliers", {"name": "Công ty Vắc xin ABC", "phone": "0901234567"}, token)[1]
    _, prods = call("GET", "/api/products?q=Vaxigrip", token=token)
    prod = next((p for p in prods["items"] if p["name"] == "Vắc xin cúm Vaxigrip"), None)
    if prod:
        prod = call("GET", f"/api/products/{prod['id']}", token=token)[1]
    else:
        st, prod = call("POST", "/api/products", {
            "name": "Vắc xin cúm Vaxigrip", "categoryId": cat["id"], "taxReduction": False, "lotManaged": False,
            "cost": 250000, "minStock": 0, "maxStock": 1000, "loyaltyPoints": False,
            "units": [{"unitName": "Liều", "conversionRate": 1, "price": 350000, "directSale": True}]}, token)
        assert st == 201, (st, prod)
    return sup, prod


def receipt(token, sup, prod, qty, paid):
    st, r = call("POST", "/api/purchase-receipts?complete=true", {
        "branchId": BRANCH, "supplierId": sup["id"], "paidAmount": paid, "paymentMethod": "CASH",
        "note": "Demo Kafka", "lines": [{"productId": prod["id"], "unitId": prod["units"][0]["id"],
                                          "quantity": qty, "unitPrice": 250000}]}, token)
    assert st == 201, (st, r)
    return r


def main():
    token = login()
    sup, prod = setup(token)
    print(f"NCC: {sup['name']} | Hàng: {prod['name']}\n")

    print("=== Kịch bản 1: bình thường ===")
    r = receipt(token, sup, prod, 20, 5_000_000)
    print(f"Kho: tạo phiếu nhập {r['code']} - 20 liều x 250.000đ, trả NCC 5.000.000đ tiền mặt")
    v, secs = wait_voucher(token, "PC" + r["code"])
    print(f"Sổ quỹ: phiếu chi {v['code']} | {v['amount']:,.0f}đ | {v.get('partnerName')} | sau {secs:.1f}s\n")

    print("=== Kịch bản 2: sales-service (Sổ quỹ) đang TẮT ===")
    docker("stop", "vaxclinic-kiotviet-sales-service-1")
    print("Đã tắt sales-service")
    r2 = receipt(token, sup, prod, 10, 2_500_000)
    print(f"Kho: vẫn nhập được phiếu {r2['code']} - trả NCC 2.500.000đ (nghiệp vụ kho không bị ảnh hưởng)")
    time.sleep(8)
    waiting = backlog()
    print(f"Kafka: {waiting} bản tin đang chờ Sổ quỹ đọc")
    docker("start", "vaxclinic-kiotviet-sales-service-1")
    print("Bật lại sales-service ...")
    v2, secs = wait_voucher(token, "PC" + r2["code"], timeout=180)
    print(f"Sổ quỹ: phiếu chi {v2['code']} | {v2['amount']:,.0f}đ xuất hiện sau {secs:.0f}s kể từ lúc bật lại\n")

    print("=== Kịch bản 3: hủy phiếu nhập -> phiếu chi bị hủy theo ===")
    st, _ = call("POST", f"/api/purchase-receipts/{r2['id']}/cancel", {}, token)
    print(f"Kho: hủy phiếu nhập {r2['code']} (HTTP {st})")
    v3, secs = wait_voucher(token, "PC" + r2["code"], status="CANCELLED")
    print(f"Sổ quỹ: phiếu chi {v3['code']} trạng thái {v3['status']} sau {secs:.1f}s\n")

    print("=== Kiểm tra không trùng ===")
    for code in ("PC" + r["code"], "PC" + r2["code"]):
        print(f"{code}: {len(cashbook_rows(token, code))} phiếu trong Sổ quỹ")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
