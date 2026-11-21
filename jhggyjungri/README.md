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
Vercel에서 새 프로젝트를 만들고 **Root Directory를 `jhggyjungri`** 로 지정합니다. 프레임워크는 Next.js로 자동 인식됩니다.
