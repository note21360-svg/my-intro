"""
data/ 폴더의 JSON 데이터를 점검하는 스크립트입니다. (PRD 9장)

실행 방법 (ggyjungri 폴더에서):
    python3 scripts/validate_data.py

- 오류가 하나라도 있으면 마지막에 "오류 N건"을 출력하고 종료 코드 1로 끝납니다.
- 오류가 없으면 "통과"를 출력하고 종료 코드 0으로 끝납니다.
- verified 가 false 인 품목(확인 필요)은 오류가 아니라 목록으로만 보여줍니다.
"""

import json
import re
import sys
from pathlib import Path

# 이 파일 위치(scripts/)의 한 단계 위 폴더 아래 data/ 를 찾습니다.
DATA = Path(__file__).resolve().parent.parent / "data"


def load(name):
    """data 폴더에서 JSON 파일 하나를 읽어 파이썬 자료(리스트/딕셔너리)로 돌려줍니다."""
    with open(DATA / name, encoding="utf-8") as f:
        return json.load(f)


def main():
    errors = []  # 발견한 오류 문장을 여기에 모읍니다.

    classes = load("classes.json")
    ingredients = load("ingredients.json")
    series = load("series.json")
    products = load("products.json")

    # ---- 1. 분류(classes) 점검 ----
    major_ids = {m["id"] for m in classes["major"]}
    minor_ids = set()
    for c in classes["minor"]:
        minor_ids.add(c["id"])
        if c["major"] not in major_ids:
            errors.append(f"소분류 {c['id']}: 대분류 '{c['major']}'가 없습니다")
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", c.get("color", "")):
            errors.append(f"소분류 {c['id']}: 색상 형식이 #RRGGBB 가 아닙니다")

    # ---- 2. 성분(ingredients) 점검: 모든 성분 class 가 classes.json 에 있는지 ----
    ing_ids = set()
    for g in ingredients:
        if g["id"] in ing_ids:
            errors.append(f"성분 id 중복: {g['id']}")
        ing_ids.add(g["id"])
        if g["class"] not in minor_ids:
            errors.append(f"성분 {g['id']}: 분류 '{g['class']}'가 classes.json 에 없습니다")
        if not g.get("ko") or not g.get("en"):
            errors.append(f"성분 {g['id']}: 한글명(ko)과 영문명(en)이 모두 있어야 합니다")

    # ---- 3. 시리즈(series) ----
    series_ids = {s["id"] for s in series}

    # ---- 4. 품목(products) 점검 ----
    product_ids = set()
    unverified = []
    for p in products:
        pid = p.get("id", "?")
        if pid in product_ids:
            errors.append(f"품목 id 중복: {pid}")
        product_ids.add(pid)

        if p.get("series") not in series_ids:
            errors.append(f"품목 {pid}: 시리즈 '{p.get('series')}'가 series.json 에 없습니다")

        # 모든 성분 id 가 ingredients.json 에 있는지, 함량이 양수인지
        if not p.get("ingredients"):
            errors.append(f"품목 {pid}: 성분이 비어 있습니다")
        for ing_id, mg in p.get("ingredients", {}).items():
            if ing_id not in ing_ids:
                errors.append(f"품목 {pid}: 성분 '{ing_id}'가 ingredients.json 에 없습니다")
            if not isinstance(mg, (int, float)) or mg <= 0:
                errors.append(f"품목 {pid}: 성분 '{ing_id}' 함량이 양수가 아닙니다 ({mg})")

        # perDoseMax, timesPerDayMax 가 양수인지
        for key in ("perDoseMax", "timesPerDayMax"):
            value = p.get(key)
            if not isinstance(value, (int, float)) or value <= 0:
                errors.append(f"품목 {pid}: {key} 가 양수가 아닙니다 ({value})")

        # sources 에 URL 이 최소 1개 있는지
        urls = [u for u in (p.get("sources") or {}).values() if u]
        if not urls:
            errors.append(f"품목 {pid}: sources 에 URL 이 하나도 없습니다")

        if p.get("type") not in ("cold", "cough", "nose"):
            errors.append(f"품목 {pid}: type 은 cold / cough / nose 중 하나여야 합니다 ({p.get('type')})")

        if not p.get("checkedAt"):
            errors.append(f"품목 {pid}: 확인 날짜(checkedAt)가 없습니다")

        if p.get("verified") is not True:
            unverified.append(f"{pid} ({p.get('name')}) {p.get('notes', '')}".strip())

    # ---- 결과 출력 ----
    print(f"분류 {len(minor_ids)}개, 성분 {len(ing_ids)}개, 시리즈 {len(series_ids)}개, 품목 {len(product_ids)}개를 읽었습니다.")

    if unverified:
        print(f"\n[확인 필요] verified=false 품목 {len(unverified)}개:")
        for line in unverified:
            print("  -", line)
    else:
        print("\n[확인 필요] 없음")

    if errors:
        print(f"\n오류 {len(errors)}건:")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    print("\n통과: 오류가 없습니다.")


if __name__ == "__main__":
    main()
