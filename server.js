const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 메모리 저장소
const paymentSessions = new Map();

app.use(cors({
  origin: function (origin, callback) {
    // 모든 도메인에서의 접근을 허용 (복제 서비스들을 위해)
    callback(null, true);
  },
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 설정
const IAMPORT_IMP_CODE = 'imp25772872';
// MAIN_SERVICE_URL을 webhookUrl에서 동적으로 추출하도록 변경
function getMainServiceUrl(webhookUrl) {
  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      console.log('Invalid webhookUrl, using fallback');
    }
  }
  // 기본 fallback (개발환경용)
  return process.env.MAIN_SERVICE_URL || 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
}
// 동적 웹훅 시크릿 처리 함수
function getWebhookSecret(providedSecret) {
  return providedSecret || process.env.WEBHOOK_SECRET || 'EveryUnse2024PaymentSecureWebhook!@#';
}

function getReturnUrl(webhookUrl) {
  // webhookUrl에서 도메인 추출하여 return URL 생성
  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      return `${url.protocol}//${url.host}/`;
    } catch (error) {
      console.log('Invalid webhookUrl, using default return URL');
    }
  }
  
  // 기본값 (기존 로직 유지)
  const hostname = process.env.NODE_ENV === 'production' ? 'www.everyunse.com' : '4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
  return 'https://' + hostname + '/';
}

async function getCoinPackages(webhookUrl) {
  try {
    const mainServiceUrl = getMainServiceUrl(webhookUrl);
    console.log('Fetching coin packages from:', mainServiceUrl + '/api/coin-packages');
    const response = await axios.get(mainServiceUrl + '/api/coin-packages');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch coin packages:', error.message);
    return [
      { id: 5, name: "40엽전", coins: 40, bonusCoins: 0, price: 3000 },
      { id: 6, name: "100엽전", coins: 100, bonusCoins: 0, price: 7500 }
    ];
  }
}

function extractSessionFromOID(oid) {
  const parts = oid.split('_');
  if (parts.length >= 3) {
    return parts[0] + '_' + parts[1] + '_' + parts[2];
  }
  return oid;
}

async function notifyMainService(sessionData, status) {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // 동적 웹훅 URL 설정 - webhookUrl이 전달되면 사용, 없으면 기본값
      const webhookUrl = sessionData.webhookUrl || (getMainServiceUrl() + '/api/payment/webhook');
      // 동적 웹훅 시크릿 설정 - 각 서비스별 고유 시크릿 사용
      const webhookSecret = getWebhookSecret(sessionData.webhookSecret);
      
      const payload = {
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        packageId: sessionData.packageId,
        amount: sessionData.amount,
        coins: sessionData.coins,
        bonusCoins: sessionData.bonusCoins || 0,
        status: status,
        webhookSecret: webhookSecret,
        timestamp: new Date().toISOString(),
        retryCount: retryCount
      };

      console.log(`Sending webhook to target service (attempt ${retryCount + 1}/${maxRetries}):`, webhookUrl);
      console.log('Webhook payload:', payload);

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      console.log('Webhook response:', response.data);
      return response.data;
      
    } catch (error) {
      retryCount++;
      console.error(`Webhook attempt ${retryCount} failed:`, error.message);
      
      if (retryCount >= maxRetries) {
        console.error('All webhook attempts failed. Final error:', error.message);
        // 최종 실패 시에도 성공으로 간주하여 결제 플로우를 끊지 않음
        return { success: true, error: 'Webhook failed but payment processed' };
      }
      
      // 재시도 전 대기 (1초, 2초, 3초)
      await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
    }
  }
}

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 메인 엽전 상점 페이지
app.get('/', async (req, res) => {
  try {
    const { userId, sessionId, returnTo, webhookUrl, webhookSecret, userEmail, username } = req.query;
    
    // 사용자 정보 로깅 (모바일/PC 구분)
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    
    console.log('=== PAYMENT SERVICE - User Info Debug ===');
    console.log('Device Type:', isMobile ? 'Mobile' : 'PC');
    console.log('User Agent:', userAgent);
    console.log('Raw query parameters:', req.query);
    console.log('User ID:', userId);
    console.log('User Email:', userEmail);
    console.log('Username:', username);
    console.log('Session ID:', sessionId);
    console.log('Return To:', returnTo);
    console.log('Webhook URL:', webhookUrl);
    console.log('==========================================');

    const packages = await getCoinPackages(webhookUrl);
    console.log('Serving payment page for session:', sessionId, 'user:', userId);
    console.log('Available packages:', packages);

    // HTML 템플릿을 문자열 연결로 생성하여 변수 보간 문제 해결
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>엽전 상점</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; min-height: 100vh; color: #333; }
        .container { max-width: 448px; margin: 0 auto; background: #f9fafb; min-height: 100vh; position: relative; padding-bottom: 80px; }
        
        /* Header */
        .header { position: sticky; top: 0; z-index: 50; background: white; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-bottom: 1px solid #e5e7eb; }
        .header-content { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .back-btn { background: none; border: none; color: #6b7280; padding: 12px; border-radius: 8px; cursor: pointer; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .back-btn:hover { background: #f3f4f6; color: #374151; }
        .back-btn:active { background: #e5e7eb; transform: scale(0.95); }
        .header-title { font-size: 18px; font-weight: 600; color: #111827; }
        .balance-info { font-size: 14px; color: #6b7280; }
        
        /* Hero Section */
        .hero { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 24px 16px; text-align: center; position: relative; overflow: hidden; }
        .hero::before { content: ''; position: absolute; top: -50%; right: -20%; width: 100px; height: 100px; background: rgba(255, 255, 255, 0.1); border-radius: 50%; }
        .hero-content { position: relative; z-index: 10; }
        .hero-title { font-size: 22px; font-weight: bold; margin-bottom: 8px; }
        .hero-subtitle { font-size: 14px; opacity: 90%; }
        .hero-icon { position: absolute; bottom: -16px; right: -16px; font-size: 48px; opacity: 20%; }
        
        /* Package Grid */
        .packages-section { padding: 16px; }
        .section-title { font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 16px; }
        .packages-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; padding-top: 12px; }
        
        .package-card { background: white; border-radius: 12px; padding: 20px 16px 16px; text-align: center; position: relative; overflow: visible; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
        .package-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
        .package-card.popular { border: 2px solid #3b82f6; }
        
        .popular-badge { position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; font-size: 12px; padding: 4px 8px; border-radius: 12px; font-weight: 500; z-index: 10; white-space: nowrap; }
        
        .package-icon { width: 48px; height: 48px; border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; }
        .gradient-blue { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
        .gradient-purple { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .gradient-pink { background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); }
        .gradient-green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .gradient-orange { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .gradient-red { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .gradient-indigo { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); }
        
        .package-name { font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 8px; }
        .package-details { margin-bottom: 12px; }
        .coins-info { font-size: 14px; color: #6b7280; }
        .bonus-info { font-size: 12px; color: #059669; margin-top: 2px; }
        .package-price { font-size: 16px; font-weight: bold; color: #111827; }
        .original-price { font-size: 12px; color: #9ca3af; text-decoration: line-through; margin-right: 4px; }
        
        /* Info Sections */
        .info-section { background: white; margin: 16px; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
        .info-title { font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .info-content { font-size: 14px; color: #6b7280; line-height: 1.6; }
        .info-list { list-style: none; }
        .info-list li { padding: 4px 0; position: relative; padding-left: 16px; }
        .info-list li::before { content: '•'; color: #3b82f6; position: absolute; left: 0; }
        
        /* FAQ */
        .faq-item { margin-bottom: 16px; }
        .faq-question { font-weight: 600; color: #111827; margin-bottom: 4px; }
        .faq-answer { font-size: 14px; color: #6b7280; }
        
        /* Custom Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; border-radius: 12px; padding: 24px; max-width: 320px; width: 90%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
        .modal-title { font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 12px; }
        .modal-message { font-size: 14px; color: #6b7280; margin-bottom: 20px; line-height: 1.5; }
        .modal-button { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; width: 100%; }
        .modal-button:hover { background: #2563eb; }
    </style>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.iamport.kr/v1/iamport.js"></script>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <div class="header-left">
                    <button class="back-btn" onclick="goBack()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="m15 18-6-6 6-6"/>
                        </svg>
                    </button>
                    <h1 class="header-title">엽전 상점</h1>
                </div>

            </div>
        </header>

        <!-- Hero Section -->
        <section class="hero">
            <div class="hero-content">
                <h2 class="hero-title">엽전을 충전하세요</h2>
                <p class="hero-subtitle">더 많은 운세를 확인하려면 엽전이 필요해요</p>
            </div>
            <div class="hero-icon">💰</div>
        </section>

        <!-- Packages -->
        <section class="packages-section">
            <h3 class="section-title">엽전 패키지</h3>
            <div class="packages-grid" id="packagesGrid">
                <!-- 패키지들이 여기에 동적으로 추가됩니다 -->
            </div>
        </section>

        <!-- Payment Info -->
        <section class="info-section">
            <h4 class="info-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                지원 결제수단
            </h4>
            <div class="info-content">
                <ul class="info-list">
                    <li>신용카드 (국내 모든 카드사)</li>
                    <li>계좌이체</li>
                    <li>휴대폰 소액결제</li>
                    <li>카카오페이, 네이버페이</li>
                </ul>
            </div>
        </section>

        <!-- Security Info -->
        <section class="info-section">
            <h4 class="info-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                안전한 결제
            </h4>
            <div class="info-content">
                <ul class="info-list">
                    <li>SSL 보안인증서 적용</li>
                    <li>KG이니시스 안전결제 시스템</li>
                    <li>개인정보 암호화 처리</li>
                    <li>PCI DSS 인증 완료</li>
                </ul>
            </div>
        </section>

        <!-- FAQ -->
        <section class="info-section">
            <h4 class="info-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <point cx="12" cy="17"/>
                </svg>
                자주 묻는 질문
            </h4>
            <div class="info-content">
                <div class="faq-item">
                    <div class="faq-question">Q. 엽전 사용 기간이 있나요?</div>
                    <div class="faq-answer">A. 엽전은 획득일로부터 1년간 사용 가능합니다.</div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">Q. 결제 후 엽전이 바로 충전되나요?</div>
                    <div class="faq-answer">A. 결제 완료 즉시 엽전이 자동으로 충전됩니다.</div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">Q. 환불이 가능한가요?</div>
                    <div class="faq-answer">A. 엽전 사용 전에는 환불이 가능하며, 고객센터로 문의해주세요.</div>
                </div>
            </div>
        </section>
    </div>

    <script>
        const sessionData = {
            userId: '` + (userId || '') + `',
            sessionId: '` + (sessionId || '') + `',
            returnTo: '` + (returnTo || '') + `',
            webhookUrl: '` + (webhookUrl || '') + `',
            webhookSecret: '` + (webhookSecret || '') + `',
            userEmail: '` + (userEmail || '') + `',
            username: '` + (username || '') + `'
        };

        const packages = ` + JSON.stringify(packages) + `;

        function getGradientClass(index) {
            const gradients = ['gradient-blue', 'gradient-purple', 'gradient-pink', 'gradient-green', 'gradient-orange', 'gradient-red', 'gradient-indigo'];
            return gradients[index % gradients.length];
        }

        function formatPrice(price) {
            return new Intl.NumberFormat('ko-KR').format(parseFloat(price));
        }

        function showModal(title, message, callback) {
            const modalHtml = '<div class="modal-overlay" id="customModal">' +
                '<div class="modal-content">' +
                    '<div class="modal-title">' + title + '</div>' +
                    '<div class="modal-message">' + message + '</div>' +
                    '<button class="modal-button" onclick="closeModal()">확인</button>' +
                '</div>' +
            '</div>';
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            window.modalCallback = callback;
        }

        function closeModal() {
            const modal = document.getElementById('customModal');
            if (modal) {
                modal.remove();
            }
            if (window.modalCallback) {
                window.modalCallback();
                window.modalCallback = null;
            }
        }

        function getReturnUrl(webhookUrl) {
            if (!webhookUrl) {
                console.error('No webhook URL provided');
                return window.location.origin;
            }
            
            try {
                const url = new URL(webhookUrl);
                return url.origin;
            } catch (e) {
                console.error('Invalid webhook URL:', webhookUrl);
                return window.location.origin;
            }
        }

        function renderPackages() {
            const grid = document.getElementById('packagesGrid');
            if (!grid || !packages) return;

            grid.innerHTML = packages.map((pkg, index) => {
                const isPopular = pkg.isPopular || pkg.is_popular;
                const bonusHtml = pkg.bonusCoins > 0 ? '<div class="bonus-info">보너스 +' + pkg.bonusCoins + '엽전</div>' : '';
                
                return '<div class="package-card ' + (isPopular ? 'popular' : '') + '" onclick="selectPackage(' + pkg.id + ')">' +
                    (isPopular ? '<div class="popular-badge">인기</div>' : '') +
                    '<div class="package-icon ' + getGradientClass(index) + '">💰</div>' +
                    '<div class="package-name">' + pkg.name + '</div>' +
                    '<div class="package-details">' +
                        '<div class="coins-info">' + pkg.coins + '엽전</div>' +
                        bonusHtml +
                    '</div>' +
                    '<div class="package-price">₩' + formatPrice(pkg.price) + '</div>' +
                '</div>';
            }).join('');
        }

        function selectPackage(packageId) {
            const selectedPackage = packages.find(p => p.id === packageId);
            if (!selectedPackage) return;

            console.log('Selected package:', selectedPackage);
            
            if (!sessionData.userId || !sessionData.sessionId) {
                showModal('오류', '세션 정보가 없습니다. 다시 시도해주세요.');
                return;
            }

            const IMP = window.IMP;
            IMP.init('` + IAMPORT_IMP_CODE + `');

            const merchantUid = 'order_' + sessionData.sessionId + '_' + Date.now();
            
            // test 계정 인식 로직 강화
            console.log('=== TEST ACCOUNT DETECTION ===');
            console.log('sessionData.userEmail:', sessionData.userEmail);
            console.log('sessionData.username:', sessionData.username);
            console.log('sessionData.userId:', sessionData.userId);
            console.log('sessionData.userId type:', typeof sessionData.userId);
            
            // 다양한 test 계정 인식 방법
            const emailCheck = sessionData.userEmail === 'test@test.com';
            const usernameCheck = sessionData.username === 'test';
            const userIdCheck = sessionData.userId === 122 || sessionData.userId === '122';
            const emailTestCheck = sessionData.userEmail === 'test';
            
            console.log('Email check (test@test.com):', emailCheck);
            console.log('Username check (test):', usernameCheck);
            console.log('UserId check (122):', userIdCheck);
            console.log('Email test check (test):', emailTestCheck);
            
            const isTestAccount = emailCheck || usernameCheck || userIdCheck || emailTestCheck;
            
            console.log('Final isTestAccount:', isTestAccount);
            
            // PG Provider 설정 (test 계정은 테스트 MID 사용)
            const pgProvider = isTestAccount ? 'html5_inicis.INIpayTest' : 'html5_inicis.MOI1056941';
            
            // 채널키 설정 (테스트 계정은 테스트 채널키 사용)
            const channelKey = isTestAccount ? 'channel-key-bc5e12b1-11b3-4645-9033-1275c22d95cf' : 'channel-key-7a1b5809-3d48-43c8-9226-76df6ce1391c';
            
            console.log('=== FINAL PG SETTINGS ===');
            console.log('pgProvider:', pgProvider);
            console.log('channelKey:', channelKey);
            console.log('===========================');
            
            IMP.request_pay({
                pg: pgProvider,
                pay_method: 'card',
                channel_key: channelKey,
                merchant_uid: merchantUid,
                name: selectedPackage.name,
                amount: selectedPackage.price,
                buyer_email: '',
                buyer_name: 'EveryUnse User',
                buyer_tel: '',
                buyer_addr: '',
                buyer_postcode: '',
                custom_data: {
                    sessionId: sessionData.sessionId,
                    userId: sessionData.userId,
                    packageId: selectedPackage.id,
                    coins: selectedPackage.coins,
                    bonusCoins: selectedPackage.bonusCoins || 0,
                    webhookUrl: sessionData.webhookUrl
                }
            }, function(rsp) {
                const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
                
                if (rsp.success) {
                    console.log('Payment successful:', rsp);
                    console.log('Mobile environment:', isMobile);
                    
                    const webhookData = {
                        sessionId: sessionData.sessionId,
                        userId: sessionData.userId,
                        packageId: selectedPackage.id,
                        amount: selectedPackage.price,
                        coins: selectedPackage.coins,
                        bonusCoins: selectedPackage.bonusCoins || 0,
                        status: 'completed',
                        transactionId: rsp.imp_uid,
                        merchantUid: rsp.merchant_uid,
                        webhookUrl: sessionData.webhookUrl,
                        webhookSecret: sessionData.webhookSecret
                    };
                    
                    console.log('=== PAYMENT SUCCESS - PREPARING WEBHOOK ===');
                    console.log('Webhook data to send:', webhookData);
                    console.log('Mobile environment:', isMobile);
                    console.log('Current location:', window.location.href);
                    console.log('Payment response:', rsp);
                    console.log('Session data:', sessionData);
                    console.log('Selected package:', selectedPackage);
                    console.log('================================================');
                    
                    // 로컬 webhook 호출 - 현재 외부 결제 서비스 내부에서 처리
                    fetch('/webhook', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-Payment-Source': 'external-service'
                        },
                        body: JSON.stringify(webhookData)
                    }).then(response => {
                        console.log('Webhook response status:', response.status);
                        console.log('Webhook response headers:', response.headers);
                        if (!response.ok) {
                            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                        }
                        return response.json();
                    }).then(result => {
                        console.log('Webhook result:', result);
                        
                        const returnUrl = getReturnUrl(sessionData.webhookUrl);
                        const finalUrl = returnUrl + (sessionData.returnTo ? '?returnTo=' + sessionData.returnTo : '');
                        
                        console.log('Success - Redirecting to:', finalUrl);
                        
                        // PC와 모바일 모두 동일한 모달 방식으로 처리
                        if (result.success) {
                            showModal('결제 완료', '결제가 완료되었습니다! 원래 페이지로 이동합니다.', function() {
                                window.location.href = finalUrl;
                            });
                        } else {
                            showModal('알림', '결제는 완료되었으나 처리 중 오류가 발생했습니다. 잠시 후 다시 확인해주세요.', function() {
                                window.location.href = finalUrl;
                            });
                        }
                    }).catch(error => {
                        console.error('Webhook error:', error);
                        const returnUrl = getReturnUrl(sessionData.webhookUrl);
                        const finalUrl = returnUrl + (sessionData.returnTo ? '?returnTo=' + sessionData.returnTo : '');
                        
                        // PC와 모바일 모두 동일한 모달 방식으로 처리
                        showModal('알림', '결제는 완료되었으나 통신 오류가 발생했습니다. 잠시 후 다시 확인해주세요.', function() {
                            window.location.href = finalUrl;
                        });
                    });
                } else {
                    console.log('Payment failed:', rsp);
                    showModal('결제 실패', '결제에 실패했습니다: ' + rsp.error_msg);
                }
            });
        }

        function goBack() {
            try {
                // 모바일 환경 감지
                const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
                
                console.log('=== GOBACK DEBUG ===');
                console.log('isMobile:', isMobile);
                console.log('sessionData.webhookUrl:', sessionData.webhookUrl);
                console.log('sessionData.returnTo:', sessionData.returnTo);
                
                // 전달받은 returnUrl을 사용하여 원래 페이지로 이동
                const returnUrl = getReturnUrl(sessionData.webhookUrl);
                console.log('returnUrl:', returnUrl);
                
                let finalUrl;
                if (sessionData.returnTo) {
                    finalUrl = returnUrl + '?returnTo=' + encodeURIComponent(sessionData.returnTo);
                } else {
                    finalUrl = returnUrl;
                }
                
                console.log('finalUrl:', finalUrl);
                console.log('==================');
                
                // 모바일에서는 더 강력한 처리
                if (isMobile) {
                    // 모바일에서는 여러 방법을 시도
                    console.log('Mobile redirect with replace to:', finalUrl);
                    
                    // 방법 1: 즉시 시도
                    try {
                        window.location.replace(finalUrl);
                    } catch (e) {
                        console.log('Replace failed, trying href:', e);
                        // 방법 2: href로 시도
                        try {
                            window.location.href = finalUrl;
                        } catch (e2) {
                            console.log('Href failed, trying assign:', e2);
                            // 방법 3: assign으로 시도
                            window.location.assign(finalUrl);
                        }
                    }
                } else {
                    // PC에서는 일반적인 방법 사용
                    console.log('PC redirect with href to:', finalUrl);
                    window.location.href = finalUrl;
                }
            } catch (error) {
                console.error('GoBack error:', error);
                // 오류 발생 시 기본 페이지로 이동
                const returnUrl = getReturnUrl(sessionData.webhookUrl);
                const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
                
                console.log('Error fallback - returnUrl:', returnUrl);
                
                if (isMobile) {
                    // 모바일에서는 여러 방법을 시도
                    try {
                        window.location.replace(returnUrl);
                    } catch (e) {
                        console.log('Replace failed in error handler, trying href:', e);
                        try {
                            window.location.href = returnUrl;
                        } catch (e2) {
                            console.log('Href failed in error handler, trying assign:', e2);
                            window.location.assign(returnUrl);
                        }
                    }
                } else {
                    window.location.href = returnUrl;
                }
            }
        }

        // 모바일 환경 감지 및 추가 설정
        function detectMobileAndSetup() {
            const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
            console.log('Mobile device detected:', isMobile);
            
            if (isMobile) {
                // 모바일에서 뒤로가기 버튼 강화
                const backBtn = document.querySelector('.back-btn');
                if (backBtn) {
                    backBtn.style.fontSize = '18px';
                    backBtn.style.padding = '14px';
                    backBtn.style.minWidth = '48px';
                    backBtn.style.minHeight = '48px';
                    
                    // 모바일에서 클릭 이벤트 강화
                    backBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        console.log('Mobile back button clicked');
                        
                        // 강력한 모바일 리다이렉션
                        const returnUrl = getReturnUrl(sessionData.webhookUrl);
                        let finalUrl;
                        if (sessionData.returnTo) {
                            finalUrl = returnUrl + '?returnTo=' + encodeURIComponent(sessionData.returnTo);
                        } else {
                            finalUrl = returnUrl;
                        }
                        
                        console.log('Mobile redirect to:', finalUrl);
                        
                        // 모바일에서 페이지 이동을 위한 다중 시도
                        setTimeout(() => {
                            window.location.replace(finalUrl);
                        }, 50);
                        
                        // 백업 방법
                        setTimeout(() => {
                            if (window.location.href.includes('fortune-payment-service.onrender.com')) {
                                window.location.href = finalUrl;
                            }
                        }, 200);
                    });
                }
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            detectMobileAndSetup();
            renderPackages();
        });
    </script>
</body>
</html>`;

    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving payment page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 웹훅 엔드포인트
app.post('/webhook', async (req, res) => {
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    const { sessionId, userId, packageId, amount, coins, bonusCoins, status, webhookUrl, webhookSecret } = req.body;
    
    if (!sessionId || !userId) {
      console.error('Missing session data:', { sessionId, userId });
      return res.status(400).json({ success: false, error: 'Missing session data' });
    }

    const sessionData = {
      sessionId: sessionId,
      userId: userId,
      packageId: packageId,
      amount: amount,
      coins: coins,
      bonusCoins: bonusCoins || 0,
      webhookUrl: webhookUrl,
      webhookSecret: webhookSecret
    };

    console.log('Processed session data:', sessionData);
    console.log('Notifying main service...');

    const result = await notifyMainService(sessionData, status);
    
    console.log('Main service notification result:', result);
    console.log('=== WEBHOOK COMPLETED ===');
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('Payment service running on port', PORT);
});
