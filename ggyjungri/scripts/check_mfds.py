"""
식약처 「의약품 제품 허가정보」 공공데이터 API로 products.json 을 대조하는 스크립트입니다.

준비
  1. 공공데이터포털(data.go.kr)에서 「식품의약품안전처_의약품 제품 허가정보」 활용신청
  2. 아래 '실행'을 하면 키를 물어봅니다. 마이페이지의 '일반 인증키(Decoding)' 를
     붙여 넣고 Enter → ggyjungri/.env 파일에 자동 저장되어 다음부터는 묻지 않습니다.
     (.env 는 .gitignore 에 들어 있어 깃허브에 올라가지 않습니다.
      키를 이 코드 파일에 직접 적지 마세요.)

실행 (ggyjungri 폴더에서)
    python3 scripts/check_mfds.py

하는 일
  - 품목마다 품목기준코드(mfdsCode)로 허가정보를 조회
  - 원료약품 및 분량(성분명·분량·단위)을 products.json 의 ingredients 와 비교
  - 허가 취소·취하 여부, 품목명, 포장단위를 함께 출력
  - 파일은 고치지 않습니다. 결과를 보고 사람이 판단해서 고칩니다.
"""

import getpass
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"

# API 버전 번호(05, 06 …)는 식약처가 바꿀 때가 있어서, 앞에서부터 차례로 시도합니다.
ENDPOINTS = [
    "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06",
    "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService06/getDrugPrdtPrmsnDtlInq05",
    "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService05/getDrugPrdtPrmsnDtlInq04",
]

UNIT_TO_MG = {"밀리그램": 1, "mg": 1, "그램": 1000, "g": 1000, "마이크로그램": 0.001, "μg": 0.001, "㎍": 0.001}


def norm(name):
    """성분명 비교용: 공백 제거, 대소문자 통일 (dl-메틸에페드린 == DL-메틸에페드린)"""
    return re.sub(r"\s+", "", name).lower()


def call_api(key, item_seq):
    """품목기준코드 하나로 API를 불러 item(딕셔너리)을 돌려줍니다. 실패하면 오류 문장을 돌려줍니다."""
    errors = []
    for url in ENDPOINTS:
        version = url.split("/")[-2]
        for attempt in (1, 2):  # 일시적인 오류가 있어 같은 주소로 한 번 더 시도
            query = urllib.parse.urlencode({"serviceKey": key, "item_seq": item_seq, "type": "json", "numOfRows": 10, "pageNo": 1})
            try:
                with urllib.request.urlopen(f"{url}?{query}", timeout=30) as res:
                    raw = res.read().decode("utf-8")
                body = json.loads(raw)["body"]
            except Exception as e:  # 404(없는 버전), 네트워크 오류, JSON 아닌 응답 등
                errors.append(f"{version}({attempt}회): {e}")
                continue
            items = body.get("items") or []
            if isinstance(items, dict):  # 응답 모양이 {"item": [...]} 인 경우
                items = items.get("item") or []
            if isinstance(items, dict):
                items = [items]
            if not items:
                return None, f"{version}: 결과 0건 (품목기준코드 확인 필요)"
            return items[0], version
    return None, " / ".join(errors)


def parse_materials(text):
    """MATERIAL_NAME 문자열을 [(성분명, mg), ...] 와 '기준'(예: 1병(30mL) 중)으로 나눕니다.
    예) 총량 : 1병(30mL) 중|성분명 : 아세트아미노펜|분량 : 300|단위 : 밀리그램|...;..."""
    result, basis = [], ""
    for chunk in (text or "").split(";"):
        fields = {}
        for part in chunk.split("|"):
            if ":" in part:
                k, v = part.split(":", 1)
                fields[k.strip()] = v.strip()
        if fields.get("총량"):
            basis = fields["총량"]
        name = fields.get("성분명")
        if not name:
            continue
        try:
            amount = float(fields.get("분량", "").replace(",", ""))
        except ValueError:
            amount = None
        factor = UNIT_TO_MG.get(fields.get("단위", ""), None)
        mg = amount * factor if (amount is not None and factor) else None
        entry = (name, mg, fields.get("단위", ""))
        if entry not in result:  # 같은 성분이 두 번 들어 있는 응답이 있어 한 번만
            result.append(entry)
    return result, basis


def load_env_file(path):
    """.env 파일의 '이름=값' 줄을 읽어 환경 변수로 등록합니다. (# 으로 시작하는 줄은 주석)
    이미 같은 이름의 환경 변수가 있으면 그 값을 그대로 둡니다."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip('"').strip("'"))


PLACEHOLDER = "여기에_발급받은_키"


def ask_and_save_key(env_path):
    """키를 붙여 넣게 하고 .env 파일에 MFDS_API_KEY=키 로 저장합니다.
    입력한 글자는 화면에 보이지 않습니다(붙여 넣은 뒤 그냥 Enter)."""
    print("공공데이터포털 '일반 인증키(Decoding)' 를 붙여 넣고 Enter 를 누르세요.")
    print("(보안을 위해 붙여 넣은 글자는 화면에 표시되지 않습니다)")
    key = getpass.getpass("인증키: ").strip().strip('"').strip("'")
    if not key:
        print("입력된 키가 없습니다. 다시 실행해 주세요.")
        sys.exit(2)
    # 기존 .env 에서 MFDS_API_KEY 줄만 바꾸고 나머지 줄은 그대로 둡니다.
    lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
    lines = [l for l in lines if not l.strip().startswith("MFDS_API_KEY=")]
    lines.append(f"MFDS_API_KEY={key}")
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"저장했습니다: {env_path}  (키 길이 {len(key)}자)\n")
    return key


def main():
    env_path = DATA.parent / ".env"
    load_env_file(env_path)
    key = os.environ.get("MFDS_API_KEY")
    if not key or key == PLACEHOLDER:
        key = ask_and_save_key(env_path)

    products = json.load(open(DATA / "products.json", encoding="utf-8"))
    ingredients = {g["id"]: g for g in json.load(open(DATA / "ingredients.json", encoding="utf-8"))}

    problems = 0
    for p in products:
        print("=" * 60)
        print(f"{p['name']}  (품목기준코드 {p['mfdsCode']})")
        item, info = call_api(key, p["mfdsCode"])
        if item is None:
            print("  조회 실패:", info)
            problems += 1
            continue
        print(f"  API: {info}")
        print(f"  허가 품목명: {item.get('ITEM_NAME')} / 업체: {item.get('ENTP_NAME')} / 허가일: {item.get('ITEM_PERMIT_DATE')}")
        cancel = item.get("CANCEL_NAME") or ""
        print(f"  허가 상태: {cancel or '(표기 없음)'} {item.get('CANCEL_DATE') or ''}".rstrip())
        if item.get("CANCEL_DATE") or (cancel and cancel != "정상"):
            print(f"  ⚠ 취소/취하: {cancel} {item.get('CANCEL_DATE') or ''}")
            problems += 1
        print(f"  포장단위(식약처): {item.get('PACK_UNIT')}  / 앱: {p['pack']}")

        materials, basis = parse_materials(item.get("MATERIAL_NAME"))
        print(f"  원료약품 기준: {basis or '(표기 없음)'}")
        # 앱 단위가 mL 이면(병 시럽 등) 앱 함량은 1mL 기준 → 식약처 값(예: 100mL 중)을 1mL 로 환산해서 비교
        per_ml = None
        if p.get("unit") == "mL":
            m = re.search(r"([\d.,]+)\s*(mL|ml|밀리리터|㎖)", basis)
            per_ml = float(m.group(1).replace(",", "")) if m else None
            print(f"  (앱은 1mL 기준 → 식약처 값 ÷ {per_ml})")
        mine = {norm(ingredients[i]["ko"]): (i, mg) for i, mg in p["ingredients"].items()}
        seen = set()
        for name, mg, unit in materials:
            k = norm(name)
            if k in mine:
                seen.add(k)
                app_mg = mine[k][1]
                if per_ml and mg is not None:
                    mg = round(mg / per_ml, 6)
                ok = mg is not None and abs(mg - app_mg) < 1e-6
                print(f"   {'일치' if ok else '불일치'}  {name}: 식약처 {mg if mg is not None else '?'} mg({unit}) / 앱 {app_mg} mg")
                problems += 0 if ok else 1
            else:
                print(f"   앱에없음  {name}: 식약처 {mg} mg({unit})  ← 성분명 표기가 다르거나 누락")
                problems += 1
        for k, (i, mg) in mine.items():
            if k not in seen:
                print(f"   식약처에없음  {ingredients[i]['ko']}: 앱 {mg} mg")
                problems += 1

    print("=" * 60)
    print("모두 일치합니다." if problems == 0 else f"확인할 항목 {problems}건")


if __name__ == "__main__":
    main()
