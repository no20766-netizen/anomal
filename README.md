# anomal — NICEPAY (Vercel 버전)

- 정적 사이트 + `api/nicepay/*` 서버리스 함수
- `checkout.html`은 `/api/nicepay/public-config`와 `/api/nicepay/order/new`를 호출하여
  NICEPAY 결제창을 연다. `returnUrl`은 `/api/nicepay/return`, 웹훅은 `/api/nicepay/webhook`.

## 환경변수(Vercel Project Settings → Environment Variables)
- NICEPAY_MODE: sandbox (운영 전환 시 production)
- NICEPAY_CLIENT_KEY: (관리자 콘솔 값)
- NICEPAY_SECRET_KEY: (관리자 콘솔 값)
- BASE_URL: https://www.anomal.kr

## 배포 후 확인
- /api/nicepay/public-config → 200 JSON
- /api/nicepay/webhook → 브라우저 GET 200 OK (웹훅 등록 테스트 통과)
