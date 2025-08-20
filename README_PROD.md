# anomal — NICEPAY (Production, Vercel)

정적 사이트 + 서버리스(API) 구성. 운영 전환용.

## 환경변수 (Vercel Project Settings)
- NICEPAY_MODE=production
- NICEPAY_CLIENT_KEY=운영 clientId
- NICEPAY_SECRET_KEY=운영 secretKey
- BASE_URL=https://www.anomal.kr

## 라우트
- GET  /api/nicepay/public-config  → { clientId, mode, returnUrl }
- GET  /api/nicepay/order/new      → { orderId, goodsName, amount, method }
- POST /api/nicepay/return         → 승인 API 호출
- ALL  /api/nicepay/webhook        → 등록 GET=200, 이벤트 POST

## 프런트
- checkout.html은 /api/nicepay/public-config로부터 받은 clientId를 AUTHNICE.requestPay에 그대로 전달.

## vercel.json
- /pay/return → /api/nicepay/return 로 rewrite (NICEPAY에서 리턴 설정 시 편의).
