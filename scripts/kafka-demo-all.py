"""Demo 4 nghiệp vụ qua Kafka trên Docker stack đang chạy (EVENTS_ENABLED=true). Chạy: python scripts/kafka-demo-all.py
1. Tạm ứng lương nhân viên  -> phiếu chi trong Sổ quỹ            (identity -> cashflow.events -> sales)
2. Hủy hóa đơn / trả hàng    -> hoàn kho                           (sales -> stock.commands -> product)
3. Hoàn thành hóa đơn        -> tự phát hành HĐĐT (bật trong Thiết lập) (sales -> sales.invoice-events -> integration
                                -> einvoice.events -> sales)
4. HĐĐT lỗi                  -> cảnh báo trong Hộp thư đến         (integration -> notification.events -> identity)
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

GW = "http://localhost:8080"
BRANCH = "00000000-0000-0000-0000-000000000001"
TOKEN = None


def call(method, path, body=None):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(GW + path, data=data, method=method)
    req.add_header("Content-Type", "application/json; charset=utf-8")
    if TOKEN:
        req.add_header("Authorization", "Bearer " + TOKEN)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8")
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        return e.code, (json.loads(raw) if raw else None)


def ok(st, body, *expected):
    assert st in (expected or (200, 201, 204)), f"HTTP {st}: {body}"
    return body


def docker(*args):
    return subprocess.run(["docker", *args], capture_output=True, text=True).stdout


def wait(fn, timeout=90, every=1.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            v = fn()
        except Exception:
            v = None
        if v:
            return v, time.time() - t0
        time.sleep(every)
    return None, time.time() - t0


def stock(product_id):
    _, p = call("GET", f"/api/products/{product_id}")
    return next((s["quantity"] for s in p.get("stocks", []) if s["branchId"] == BRANCH), 0)


def product():
    _, prods = call("GET", "/api/products?q=Vaxigrip")
    p = next(p for p in prods["items"] if p["name"] == "Vắc xin cúm Vaxigrip")
    return ok(*call("GET", f"/api/products/{p['id']}"))


def new_invoice(p, qty):
    return ok(*call("POST", "/api/invoices", {
        "id": str(uuid.uuid4()), "branchId": BRANCH, "saleMode": "QUICK", "paymentMethod": "CASH", "offline": False,
        "lines": [{"productId": p["id"], "unitId": p["units"][0]["id"], "productCode": p["units"][0]["code"],
                   "productName": p["name"], "unitName": p["units"][0]["unitName"], "quantity": qty, "unitPrice": 350000}]}))


def cashbook(code):
    _, page = call("GET", "/api/cashbook?size=50")
    return next((v for v in page["items"] if v.get("code") == code), None)


def inbox(pred):
    _, page = call("GET", "/api/notifications?size=50")
    items = page["items"] if isinstance(page, dict) else page
    return next((n for n in items if pred(n)), None)


def flow1():
    print("=== 1. Tạm ứng lương -> Sổ quỹ ===")
    _, emps = call("GET", "/api/hr/employees?q=Nguyen")
    items = emps["items"] if isinstance(emps, dict) else emps
    emp = next((e for e in items if e["name"] == "Nguyễn Văn Demo"), None) or \
        ok(*call("POST", "/api/hr/employees", {"name": "Nguyễn Văn Demo", "phone": "0909000111", "branchId": BRANCH}))
    before = {v["code"] for v in call("GET", "/api/cashbook?size=100")[1]["items"]}
    ok(*call("POST", f"/api/hr/employees/{emp['id']}/advances",
             {"amount": 1_500_000, "fund": "CASH", "branchId": BRANCH, "note": "Tạm ứng demo Kafka"}))
    print(f"HR: tạm ứng 1.500.000đ cho {emp['name']}")

    def new_voucher():
        return next((v for v in call("GET", "/api/cashbook?size=100")[1]["items"]
                     if v["code"] not in before and v.get("partnerName") == emp["name"]), None)
    v, s = wait(new_voucher)
    print(f"Sổ quỹ: phiếu chi {v['code']} | {v['amount']:,.0f}đ | {v['partnerName']} | sau {s:.1f}s\n" if v
          else "Sổ quỹ: KHÔNG thấy phiếu chi!\n")


def flow2(p):
    print("=== 2. Hủy hóa đơn / trả hàng -> hoàn kho ===")
    s0 = stock(p["id"])
    inv = new_invoice(p, 2)
    s1 = stock(p["id"])
    print(f"Bán {inv['code']}: 2 liều -> tồn {s0:g} -> {s1:g} (trừ kho đồng bộ ngay)")
    docker("stop", "vaxclinic-kiotviet-product-service-1")
    print("Tắt product-service (kho)")
    st, body = call("POST", f"/api/invoices/{inv['id']}/cancel")
    print(f"Hủy hóa đơn {inv['code']}: HTTP {st}, trạng thái {body.get('status') if body else '-'} (vẫn hủy được khi kho tắt)")
    docker("start", "vaxclinic-kiotviet-product-service-1")
    print("Bật lại product-service ...")
    _, s = wait(lambda: stock(p["id"]) == s0, timeout=180, every=3)
    print(f"Kho: tồn trở về {stock(p['id']):g} sau {s:.0f}s kể từ lúc bật lại")

    inv2 = new_invoice(p, 3)
    s2 = stock(p["id"])
    ret = ok(*call("POST", "/api/sales-returns", {"id": str(uuid.uuid4()), "invoiceId": inv2["id"], "paymentMethod": "CASH",
                                                  "lines": [{"invoiceLineId": inv2["lines"][0]["id"], "quantity": 1}]}))
    _, s = wait(lambda: stock(p["id"]) == s2 + 1)
    print(f"Bán {inv2['code']} 3 liều, trả {ret['code']} 1 liều -> tồn {s2:g} -> {stock(p['id']):g} sau {s:.1f}s\n")
    return inv2


def flow3_4(p):
    print("=== 3+4. Hoàn thành hóa đơn -> tự phát hành HĐĐT -> lỗi -> cảnh báo Hộp thư đến ===")
    _, cur = call("GET", "/api/einvoice/settings")
    body = {"environment": "TEST", "appId": "demo-app", "taxCode": "0101234567", "username": "demo", "password": "demo",
            "invSeries": "2C26MAA", "invoiceName": "Hóa đơn bán hàng", "sendEmail": False, "autoPublish": True}
    ok(*call("PUT", "/api/einvoice/settings", body))
    print("Thiết lập: bật 'Tự động phát hành HĐĐT khi hoàn thành hóa đơn' (MISA thử nghiệm, tài khoản giả)")
    inv = new_invoice(p, 1)
    print(f"Bán {inv['code']} (hoàn thành)")

    def record():
        _, rows = call("GET", f"/api/einvoices?invoiceIds={inv['id']}")
        return rows[0] if rows and (rows[0].get("status") == "PUBLISHED" or rows[0].get("error")) else None
    r, s = wait(record, timeout=120)
    if r:
        print(f"HĐĐT: integration tự phát hành -> trạng thái {r.get('status')} sau {s:.1f}s | lỗi: {r.get('error')}")
    else:
        print("HĐĐT: KHÔNG thấy bản ghi!")
    n, s = wait(lambda: inbox(lambda n: inv["code"] in (n.get("title") or "")), timeout=60)
    print(f"Hộp thư đến: \"{n['title']}\" sau {s:.1f}s" if n else "Hộp thư đến: KHÔNG thấy cảnh báo!")
    body["autoPublish"] = False
    call("PUT", "/api/einvoice/settings", body)
    print("Thiết lập: tắt lại tự động phát hành\n")


def main():
    global TOKEN
    TOKEN = call("POST", "/api/auth/login", {"username": "admin", "password": "Admin@12345"})[1]["accessToken"]
    p = product()
    flow1()
    flow2(p)
    flow3_4(p)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
