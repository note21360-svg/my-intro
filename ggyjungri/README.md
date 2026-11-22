# 종합감기약 성분 비교 앱

약국 상담용 종합감기약 성분·함량 비교 웹앱 (Next.js + TypeScript, 정적 생성).
요구사항은 PRD v1.0(2026-11-21) 기준입니다.

## 폴더 구조
- `data/` — 데이터 JSON (classes, ingredients, series, products). **품목을 추가할 때는 이 파일만 고치면 됩니다.**
- `components/ColdMedApp.tsx` — 화면 전체 (제품 탭·비교 탭)
- `app/` — 페이지, 레이아웃, 스타일
- `scripts/validate_data.py` — 데이터 점검 스크립트 (Python)

## 실행
```bash
npm install          # 처음 한 번
npm run dev          # http://localhost:3000 에서 개발용 실행
python3 scripts/validate_data.py   # 데이터 점검 (커밋 전 필수)
npm run build        # 배포용 빌드 확인
```

## Vercel 배포
Vercel에서 새 프로젝트를 만들고 **Root Directory를 `ggyjungri`** 로 지정합니다. 프레임워크는 Next.js로 자동 인식됩니다.

## 식약처 허가정보 API로 데이터 대조
1. 공공데이터포털(data.go.kr)에서 **「식품의약품안전처_의약품 제품 허가정보」** 활용신청 → 마이페이지에서 **일반 인증키(Decoding)** 복사
2. 실행 (윈도우는 `python3` 대신 `python`)
   ```bash
   python3 scripts/check_mfds.py
   ```
   처음 실행하면 `인증키:`를 묻습니다. 복사한 키를 **붙여 넣고 Enter**를 누르세요. 화면에는 표시되지 않습니다.
   키는 `ggyjungri/.env`에 자동 저장되고, 다음부터는 묻지 않습니다. `.env`는 `.gitignore`에 들어 있어 깃허브에 올라가지 않습니다.
   품목마다 원료약품 및 분량을 `products.json`과 비교해 일치/불일치, 취소·취하 여부, 포장단위를 출력합니다. 파일은 고치지 않습니다.
