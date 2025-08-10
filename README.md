# anomal.kr — Direct checkout (Toss Payments, no framework)

## Project structure
```
/ (static)
  index.html          # 메인 랜딩 + 제품 카드 → /checkout.html로 연결
  checkout.html       # 토스 결제창 호출
  success.html        # 결제 성공 리다이렉트 → /api/toss/confirm 승인
  fail.html           # 결제 실패/취소 리다이렉트
  robots.txt
  sitemap.xml
  terms.html, privacy.html
  /img                # 이미지 폴더 (cover.jpg, cap_*.jpg)
  /api/toss/confirm.js  # Vercel serverless function
  /api/toss/webhook.js  # Vercel webhook endpoint (선택)
```

## Local setup
이미 정적 파일이라 로컬에서 브라우저로 열어도 됩니다. 다만 토스 결제와 서버리스 API 확인은 Vercel 배포 후 정상 동작합니다.

## Deploy to Vercel
1. 이 폴더를 GitHub에 올립니다.
2. [vercel.com](https://vercel.com) → New Project → GitHub repo import
3. Project Settings → Environment Variables
   - `PUBLIC_TOSS_CLIENT_KEY` = `test_ck_...`
   - `TOSS_SECRET_KEY` = `test_sk_...`
4. Redeploy → 임시 도메인 확인
5. Settings → Domains → `anomal.kr` 연결 → DNS 안내값을 등록기관에 추가 → HTTPS 자동 발급

## GitHub 초간단 가이드
```
# 최초 1회
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

# 리포지토리 초기화
git init
git add .
git commit -m "anomal.kr v1 with Toss"
git branch -M main

# GitHub에 새 repo 만들고 URL 복사 후
git remote add origin https://github.com/<yourname>/anomal-site.git
git push -u origin main

# 변경 반영
git add .
git commit -m "update: copy & price"
git push
```
Vercel은 `main` 브랜치에 push될 때 자동 배포합니다.

## Toss Payments (test → live)
- 테스트 키로 전 과정 검증 후, Vercel 환경변수를 live 키로 교체하고 재배포하세요.
- success.html → `/api/toss/confirm` 에서 서버 승인까지 되어야 결제가 최종 완료됩니다.

## 운영 체크리스트
- 하단 사업자정보, 약관/개인정보 페이지 보완
- Google Analytics / Search Console / 네이버 서치어드바이저 설정
- 주문 저장(구글 시트/Supabase) 또는 관리자 페이지 구축 (차후)
