const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 메모리 저장소 (간단한 세션 관리용)
const paymentSessions = new Map();

app.use(cors({
  origin: ['https://www.everyunse.com', 'https://everyunse.com', 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev'],
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// KG Inicis 설정
const INICIS_MID = process.env.INICIS_MID || 'INIpayTest';
const INICIS_SIGNKEY = process.env.INICIS_SIGNKEY || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS';
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'EveryUnse2024PaymentSecureWebhook!@#';

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 코인 패키지 정보 가져오기
async function getCoinPackages() {
  try {
    console.log('Fetching coin packages from:', `${MAIN_SERVICE_URL}/api/coin-packages`);
    const response = await axios.get(`${MAIN_SERVICE_URL}/api/coin-packages`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch coin packages:', error.message);
    // 기본 패키지 반환
    return [
      { id: 5, name: "40엽전", coins: 40, bonusCoins: 0, price: 3000 },
      { id: 6, name: "100엽전", coins: 100, bonusCoins: 0, price: 7500 }
    ];
  }
}

// 메인 엽전 상점 페이지
app.get('/', async (req, res) => {
  try {
    const packages = await getCoinPackages();
    
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>엽전 상점 - EveryUnse</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #f9fafb;
            min-height: 100vh;
            line-height: 1.6;
        }

        .container {
            max-width: 448px;
            margin: 0 auto;
            min-height: 100vh;
            background: white;
        }

        /* Header */
        .header {
            position: sticky;
            top: 0;
            z-index: 50;
            background: white;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-bottom: 1px solid #e5e7eb;
        }

        .header-content {
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .back-btn {
            background: none;
            border: none;
            padding: 8px;
            cursor: pointer;
            border-radius: 8px;
            transition: background-color 0.2s;
        }

        .back-btn:hover {
            background-color: #f3f4f6;
        }

        .header-title {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
        }

        .coin-balance {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
        }

        /* Main Content */
        .main {
            padding-bottom: 80px;
        }

        /* Hero Section */
        .hero {
            padding: 16px;
        }

        .hero-card {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .hero-icon {
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            font-size: 24px;
        }

        .hero-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 8px;
        }

        .hero-description {
            font-size: 16px;
            opacity: 0.9;
        }

        .hero-decoration {
            position: absolute;
            bottom: -20px;
            right: -20px;
            font-size: 80px;
            opacity: 0.1;
        }

        /* Packages Section */
        .packages-section {
            padding: 0 16px 16px;
        }

        .section-title {
            font-size: 20px;
            font-weight: bold;
            color: #111827;
            margin-bottom: 16px;
        }

        .packages-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .package-card {
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }

        .package-card:hover {
            border-color: #3b82f6;
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .package-icon {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 12px;
            color: white;
            font-size: 24px;
        }

        .package-icon-blue {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        }

        .package-icon-purple {
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        }

        .package-name {
            font-size: 18px;
            font-weight: bold;
            color: #111827;
            margin-bottom: 4px;
        }

        .package-price {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 4px;
        }

        .package-price-blue {
            color: #3b82f6;
        }

        .package-price-purple {
            color: #8b5cf6;
        }

        .package-unit {
            font-size: 14px;
            color: #6b7280;
        }

        .purchase-btn {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: calc(100% - 40px);
            max-width: 408px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            border: none;
            padding: 16px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: none;
        }

        .purchase-btn:hover {
            transform: translateX(-50%) translateY(-2px);
            box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
        }

        .purchase-btn.show {
            display: block;
        }

        .selected {
            border-color: #3b82f6;
            background: #eff6ff;
        }

        .notification {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            display: none;
        }

        .notification.show {
            display: block;
            animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <div class="header-left">
                    <button class="back-btn" onclick="goBack()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5"></path>
                            <path d="m12 19-7-7 7-7"></path>
                        </svg>
                    </button>
                    <h1 class="header-title">엽전 상점</h1>
                </div>
                <div class="coin-balance">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                        <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                    </svg>
                    <span id="coinBalance">엽전</span>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="main">
            <!-- Hero Section -->
            <section class="hero">
                <div class="hero-card">
                    <div class="hero-icon">💰</div>
                    <h2 class="hero-title">엽전 충전하기</h2>
                    <p class="hero-description">더 많은 운세를 확인하려면 엽전이 필요해요</p>
                    <div class="hero-decoration">💰</div>
                </div>
            </section>

            <!-- Packages Section -->
            <section class="packages-section">
                <h2 class="section-title">엽전 패키지</h2>
                <div class="packages-grid" id="packagesGrid">
                    <!-- 패키지들이 동적으로 로드됩니다 -->
                </div>
            </section>
        </main>

        <!-- Purchase Button -->
        <button class="purchase-btn" id="purchaseBtn" onclick="handlePurchase()">
            구매하기
        </button>

        <!-- Notification -->
        <div class="notification" id="notification">
            <span id="notificationText"></span>
        </div>
    </div>

    <script>
        let selectedPackage = null;
        const packages = ${JSON.stringify(packages)};

        // 패키지 렌더링
        function renderPackages() {
            const grid = document.getElementById('packagesGrid');
            grid.innerHTML = packages.map((pkg, index) => {
                const iconClass = index % 2 === 0 ? 'package-icon-blue' : 'package-icon-purple';
                const priceClass = index % 2 === 0 ? 'package-price-blue' : 'package-price-purple';
                
                return \`
                    <div class="package-card" onclick="selectPackage(\${pkg.id})">
                        <div class="package-icon \${iconClass}">💰</div>
                        <div class="package-name">\${pkg.name}</div>
                        <div class="package-price \${priceClass}">\${Math.floor(pkg.price).toLocaleString()}</div>
                        <div class="package-unit">원</div>
                    </div>
                \`;
            }).join('');
        }

        // 패키지 선택
        function selectPackage(packageId) {
            selectedPackage = packages.find(p => p.id === packageId);
            
            // 모든 카드에서 selected 클래스 제거
            document.querySelectorAll('.package-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // 선택된 카드에 selected 클래스 추가
            event.currentTarget.classList.add('selected');
            
            // 구매 버튼 표시
            const purchaseBtn = document.getElementById('purchaseBtn');
            purchaseBtn.classList.add('show');
            purchaseBtn.textContent = \`\${selectedPackage.name} 구매하기 (\${Math.floor(selectedPackage.price).toLocaleString()}원)\`;
        }

        // 구매 처리
        async function handlePurchase() {
            if (!selectedPackage) {
                showNotification('패키지를 선택해주세요');
                return;
            }

            showNotification('결제를 준비하고 있습니다...');

            try {
                // 결제 세션 생성
                const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const merchant_uid = 'ORDER_' + Date.now() + Math.random().toString(36).substr(2, 5);
                
                // 바로 PG 모듈 초기화
                initializePayment(selectedPackage, sessionId, merchant_uid);
                
            } catch (error) {
                console.error('Purchase error:', error);
                showNotification('결제 시작 중 오류가 발생했습니다');
            }
        }

        // PG 모듈 초기화
        function initializePayment(packageData, sessionId, merchant_uid) {
            // KG Inicis 결제 모듈 로드
            const script = document.createElement('script');
            script.src = 'https://stdpay.inicis.com/stdjs/INIStdPay.js';
            script.onload = function() {
                requestPayment(packageData, sessionId, merchant_uid);
            };
            document.head.appendChild(script);
        }

        // 결제 요청
        function requestPayment(packageData, sessionId, merchant_uid) {
            const paymentData = {
                mid: 'INIpayTest', // 테스트용 MID
                oid: merchant_uid,
                price: packageData.price,
                timestamp: Date.now(),
                signature: generateSignature(merchant_uid, packageData.price),
                mKey: 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS',
                currency: 'WON',
                goodname: packageData.name,
                buyername: '구매자',
                buyertel: '010-0000-0000',
                buyeremail: 'test@example.com',
                returnUrl: window.location.origin + '/payment/return',
                closeUrl: window.location.origin + '/payment/close',
                acceptmethod: 'HPP(1):no_bankbook:centerCd(Y)'
            };

            // KG Inicis 결제창 호출
            INIStdPay.pay(paymentData);
        }

        // 서명 생성 (간단한 버전)
        function generateSignature(oid, price) {
            const timestamp = Date.now();
            return btoa(oid + price + timestamp).substr(0, 32);
        }

        // 뒤로 가기
        function goBack() {
            window.close();
        }

        // 결제 결과 메시지 리스너
        window.addEventListener('message', function(event) {
            if (event.data.type === 'payment_success') {
                showNotification('결제가 완료되었습니다!');
                setTimeout(() => {
                    window.close();
                }, 2000);
            } else if (event.data.type === 'payment_fail') {
                showNotification('결제가 실패했습니다.');
            } else if (event.data.type === 'payment_close') {
                showNotification('결제가 취소되었습니다.');
            }
        });

        // 알림 표시
        function showNotification(message) {
            const notification = document.getElementById('notification');
            const text = document.getElementById('notificationText');
            text.textContent = message;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        // 초기화
        document.addEventListener('DOMContentLoaded', function() {
            renderPackages();
        });
    </script>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error rendering main page:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 기존 아임포트 결제 페이지
app.get('/payment', (req, res) => {
  const { amount, coins, sessionId, merchant_uid, name } = req.query;
  
  if (!amount || !coins || !sessionId || !merchant_uid) {
    return res.status(400).send('Missing required parameters');
  }

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>결제하기 - EveryUnse</title>
    <script src="https://cdn.iamport.kr/v1/iamport.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
        }
        .amount {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin: 20px 0;
        }
        .coins {
            font-size: 18px;
            color: #666;
            margin-bottom: 30px;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 50px;
            cursor: pointer;
            width: 100%;
            margin: 10px 0;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .btn:active {
            transform: translateY(0);
        }
        .info {
            font-size: 14px;
            color: #888;
            margin-top: 20px;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🔮 EveryUnse</div>
        <div>주문번호: ${merchant_uid}</div>
        <div class="amount">${Number(amount).toLocaleString()}원</div>
        <div class="coins">코인: ${coins}개</div>
        
        <button id="payBtn" class="btn" onclick="requestPay()">
            결제하기
        </button>
        
        <div class="info">
            📱 모바일 환경에서 최적화된 결제창이 제공됩니다.
        </div>
    </div>

    <script>
        const IMP = window.IMP;
        IMP.init('imp75075771');
        
        function requestPay() {
            IMP.request_pay({
                pg: 'html5_inicis',
                pay_method: 'card',
                merchant_uid: '${merchant_uid}',
                name: '${name || '코인 패키지'}',
                amount: ${amount},
                buyer_email: 'support@everyunse.com',
                buyer_name: 'EveryUnse 사용자',
                buyer_tel: '010-0000-0000',
                buyer_addr: '서울특별시',
                buyer_postcode: '123-456',
                m_redirect_url: window.location.origin + '/payment/complete'
            }, function(response) {
                console.log('Payment response:', response);
                
                if (response.success) {
                    // 결제 성공 시 웹훅 호출
                    fetch('/webhook/payment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            sessionId: '${sessionId}',
                            transactionId: response.imp_uid,
                            status: 'success',
                            amount: ${amount},
                            coins: ${coins}
                        })
                    }).then(() => {
                        alert('결제가 완료되었습니다!');
                        window.close();
                    }).catch(error => {
                        console.error('Webhook error:', error);
                        alert('결제는 완료되었으나 처리 중 오류가 발생했습니다.');
                        window.close();
                    });
                } else {
                    console.log('Payment failed:', response);
                    alert('결제에 실패했습니다: ' + response.error_msg);
                }
            });
        }
        
        // 자동 결제 시작
        setTimeout(() => {
            requestPay();
        }, 1000);
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// 결제 완료 처리 (모바일 리디렉션)
app.get('/payment/complete', (req, res) => {
  const { imp_uid, merchant_uid, imp_success } = req.query;
  
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>결제 완료 - EveryUnse</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        .success {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
        }
        .message {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 50px;
            cursor: pointer;
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success">${imp_success === 'true' ? '✅' : '❌'}</div>
        <div class="title">${imp_success === 'true' ? '결제 완료' : '결제 실패'}</div>
        <div class="message">
            ${imp_success === 'true' ? 
              '엽전이 충전되었습니다!<br>앱으로 돌아가서 확인해주세요.' : 
              '결제가 취소되거나 실패했습니다.'
            }
        </div>
        <button class="btn" onclick="window.close()">앱으로 돌아가기</button>
    </div>

    <script>
        // 결제 성공 시 웹훅 호출
        if ('${imp_success}' === 'true') {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('sessionId') || extractSessionFromOID('${merchant_uid}');
            
            fetch('/webhook/payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    transactionId: '${imp_uid}',
                    status: 'success',
                    merchant_uid: '${merchant_uid}'
                })
            }).catch(error => {
                console.error('Webhook error:', error);
            });
        }
        
        function extractSessionFromOID(oid) {
            return 'session_' + oid.split('_')[1] + '_extracted';
        }
        
        // 3초 후 자동으로 창 닫기
        setTimeout(() => {
            window.close();
        }, 3000);
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// 웹훅 엔드포인트
app.post('/webhook/payment', async (req, res) => {
  try {
    const { sessionId, transactionId, status } = req.body;
    
    console.log('Webhook received:', { sessionId, transactionId, status });
    
    // 메인 서비스에 결제 결과 전송
    const webhookData = {
      sessionId,
      transactionId,
      status,
      timestamp: new Date().toISOString()
    };
    
    try {
      const response = await fetch(`${MAIN_SERVICE_URL}/api/payment/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET
        },
        body: JSON.stringify(webhookData)
      });
      
      if (response.ok) {
        console.log('Webhook sent successfully to main service');
        res.json({ success: true });
      } else {
        console.error('Failed to send webhook to main service:', await response.text());
        res.status(500).json({ success: false, error: 'Failed to notify main service' });
      }
    } catch (error) {
      console.error('Error sending webhook to main service:', error);
      res.status(500).json({ success: false, error: 'Failed to notify main service' });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// OID에서 세션 ID 추출
function extractSessionFromOID(oid) {
  const match = oid.match(/ORDER_(\d+)/);
  if (match) {
    return `session_${match[1]}_extracted`;
  }
  return `session_${Date.now()}_fallback`;
}

// 메인 서비스에 알림 전송
async function notifyMainService(sessionData, status) {
  try {
    const webhookUrl = `${MAIN_SERVICE_URL}/api/payment/webhook`;
    
    const payload = {
      sessionId: sessionData.sessionId,
      status: status,
      transactionId: sessionData.transactionId || null,
      timestamp: new Date().toISOString()
    };

    console.log('Sending webhook to main service:', webhookUrl, payload);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Failed to notify main service:', response.status, await response.text());
      return false;
    }

    console.log('Successfully notified main service');
    return true;
  } catch (error) {
    console.error('Error notifying main service:', error);
    return false;
  }
}

// KG Inicis 결제 완료 처리
app.post('/payment/return', (req, res) => {
  console.log('Payment return received:', req.body);
  
  const { P_STATUS, P_OID, P_AMT, P_UNAME } = req.body;
  
  if (P_STATUS === '00') {
    // 결제 성공
    res.send(`
      <script>
        alert('결제가 완료되었습니다!');
        window.opener.postMessage({type: 'payment_success', oid: '${P_OID}'}, '*');
        window.close();
      </script>
    `);
  } else {
    // 결제 실패
    res.send(`
      <script>
        alert('결제가 실패했습니다.');
        window.opener.postMessage({type: 'payment_fail', oid: '${P_OID}'}, '*');
        window.close();
      </script>
    `);
  }
});

// KG Inicis 결제창 닫기 처리
app.post('/payment/close', (req, res) => {
  console.log('Payment close received:', req.body);
  
  res.send(`
    <script>
      window.opener.postMessage({type: 'payment_close'}, '*');
      window.close();
    </script>
  `);
});

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
  console.log(`Main service URL: ${MAIN_SERVICE_URL}`);
  console.log(`Webhook secret configured: ${WEBHOOK_SECRET ? 'Yes' : 'No'}`);
});
