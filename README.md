# EveryUnse Payment Service v1.2.0

아임포트 통합 결제 시스템을 사용한 사주운세 플랫폼용 결제 서비스

## 주요 변경사항

- **KG Inicis 직접 호출 제거**: payView.jsp 404 오류 해결
- **아임포트 통합 결제**: PC/모바일 모든 결제를 아임포트로 통합
- **안정적인 결제 페이지**: 자체 호스팅 결제 페이지 제공
- **향상된 세션 관리**: 결제 검증 및 콜백 처리 개선

## 결제 플로우

### PC 결제 (프로덕션)
1. 클라이언트 → 결제 서비스 API 호출
2. 결제 서비스 → 아임포트 결제 페이지로 리다이렉트
3. 사용자 → 아임포트에서 결제 진행
4. 아임포트 → 결제 완료 후 검증 API 호출
5. 결제 서비스 → 메인 서비스에 웹훅 전송

### 모바일 결제
- KG Inicis Smart Payment 시스템 유지
- HTTPS 전용으로 Mixed Content 문제 해결

### 테스트 모드
- PC 결제 시뮬레이션 (개발 환경)
- 실제 결제 없이 성공 처리

## 환경 변수

```bash
NODE_ENV=production
INICIS_MID=your_inicis_mid
INICIS_SIGNKEY=your_inicis_signkey
MAIN_SERVICE_URL=https://www.everyunse.com
WEBHOOK_SECRET=EveryUnse2024PaymentSecureWebhook!@#

API 엔드포인트
GET /payment - 아임포트 결제 페이지
POST /verify-payment - 아임포트 결제 검증
POST /api/create-payment - 결제 요청 생성
POST /api/mobile-payment-complete - 모바일 결제 완료
GET /health - 헬스체크
문제 해결
✅ 404 오류 해결: KG Inicis 직접 호출 제거
✅ Mixed Content 해결: HTTPS 전용 리소스 사용
✅ 안정적인 결제: 아임포트 통합으로 호환성 개선
✅ iframe 제약 해결: 별도 결제 페이지로 우회
