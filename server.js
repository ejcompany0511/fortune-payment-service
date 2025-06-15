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
const INICIS_MID = 'INIpayTest';
const INICIS_SIGNKEY = 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS';
const INICIS_API_KEY = 'ItEQKi3rY7uvDS8l';
const INICIS_API_IV = 'HYb3yQ4f65QL89==';
const INICIS_CHANNEL_KEY = 'channel-key-bc5e12b1-11b3-4645-9033-1275c22d95cf';
const INICIS_MOBILE_HASHKEY = '3CB8183A4BE283555ACC8363C0360223';
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
const WEBHOOK_SECRET = 'EveryUnse2024PaymentSecureWebhook!@#';

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
    const { userId, sessionId, returnTo } = req.query;
    
    console.log('Payment service accessed with params:', { userId, sessionId, returnTo });
    
    res.send(`
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
            font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 480px;
            margin: 0 auto;
            background: white;
            min-height: 100vh;
            position: relative;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-content {
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
            color: white;
            padding: 8px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .back-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .header-title {
            font-size: 18px;
            font-weight: 600;
        }

        .coin-balance {
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }

        .hero-section {
            padding: 24px 20px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            text-align: center;
        }

        .hero-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 32px 24px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            position: relative;
            overflow: hidden;
        }

        .hero-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }

        .hero-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .hero-subtitle {
            font-size: 16px;
            opacity: 0.9;
            line-height: 1.5;
        }

        .hero-decoration {
            position: absolute;
            top: -20px;
            right: -20px;
            font-size: 80px;
            opacity: 0.1;
        }

        .packages-section {
            padding: 32px 20px;
        }

        .packages-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 20px;
            color: #1f2937;
        }

        .packages-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-bottom: 32px;
        }

        .package-card {
            background: white;
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            border: 2px solid #e5e7eb;
            transition: all 0.3s ease;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }

        .package-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            border-color: #8b5cf6;
        }

        .package-card.popular {
            border-color: #f59e0b;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        }

        .package-card.popular::before {
            content: "인기";
            position: absolute;
            top: 8px;
            right: 8px;
            background: #f59e0b;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
        }

        .package-icon {
            font-size: 32px;
            margin-bottom: 12px;
        }

        .package-name {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #1f2937;
        }

        .package-price {
            font-size: 16px;
            color: #6b7280;
            margin-bottom: 16px;
        }

        .package-btn {
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: all 0.3s ease;
        }

        .package-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        }

        .payment-info {
            padding: 0 20px 32px;
        }

        .payment-card {
            background: #f8fafc;
            border-radius: 16px;
            padding: 24px;
            border: 1px solid #e2e8f0;
        }

        .payment-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }

        .payment-title {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
        }

        .payment-methods h4 {
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 12px;
        }

        .payment-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }

        .payment-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 0;
            font-size: 14px;
            color: #6b7280;
        }

        .check-icon {
            color: #10b981;
            font-weight: 600;
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1f2937;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            display: none;
            z-index: 1000;
            font-weight: 600;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .notification.success {
            background: #10b981;
        }

        .notification.error {
            background: #ef4444;
        }

        @media (max-width: 640px) {
            .container {
                margin: 0;
                padding-bottom: 60px;
            }
            
            .hero-card {
                padding: 20px;
            }
            
            .packages-grid {
                gap: 8px;
            }
            
            .package-card {
                padding: 12px;
            }
        }
    </style>
    <!-- KG 이니시스 결제 Form -->
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
                <div class="coin-balance">
                    💰 잔액
                </div>
            </div>
        </header>

        <!-- Hero Section -->
        <section class="hero-section">
            <div class="hero-card">
                <div class="hero-icon">
                    💰
                </div>
                <h2 class="hero-title">엽전 충전하기</h2>
                <p class="hero-subtitle">더 많은 운세를 확인하려면 엽전이 필요해요</p>
                <div class="hero-decoration">💰</div>
            </div>
        </section>

        <!-- Packages Section -->
        <section class="packages-section">
            <h3 class="packages-title">엽전 패키지</h3>
            <div class="packages-grid" id="packages-container">
                <!-- 패키지들이 여기에 동적으로 추가됩니다 -->
            </div>
        </section>

        <!-- Payment Info -->
        <section class="payment-info">
            <div class="payment-card">
                <div class="payment-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    <span class="payment-title">결제 정보</span>
                </div>
                
                <div class="payment-methods">
                    <h4>지원 결제 수단</h4>
                    <div class="payment-grid">
                        <div class="payment-item">
                            <span class="check-icon">✓</span>
                            <span>신용카드</span>
                        </div>
                        <div class="payment-item">
                            <span class="check-icon">✓</span>
                            <span>체크카드</span>
                        </div>
                        <div class="payment-item">
                            <span class="check-icon">✓</span>
                            <span>계좌이체</span>
                        </div>
                        <div class="payment-item">
                            <span class="check-icon">✓</span>
                            <span>가상계좌</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>

    <!-- Notification -->
    <div id="notification" class="notification"></div>

    <script>
        // URL 파라미터에서 정보 추출
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId') || localStorage.getItem('userId');
        const sessionId = urlParams.get('sessionId') || Date.now().toString();
        const returnTo = urlParams.get('returnTo') || 'home';
        
        console.log('Payment page loaded with:', { userId, sessionId, returnTo });
        
        // 로컬 스토리지에 정보 저장
        if (userId) localStorage.setItem('userId', userId);
        localStorage.setItem('sessionId', sessionId);
        localStorage.setItem('returnTo', returnTo);

        function getReturnUrl() {
            const returnTo = localStorage.getItem('returnTo') || 'home';
            
            // 도메인 감지
            const hostname = window.location.hostname;
            let baseUrl = 'https://www.everyunse.com';
            
            if (hostname.includes('replit.dev')) {
                baseUrl = 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
            }
            
            const urlMap = {
                'home': baseUrl + '/',
                'profile': baseUrl + '/profile',
                'transactions': baseUrl + '/transactions',
                'coins': baseUrl + '/coins'
            };
            
            return urlMap[returnTo] || baseUrl + '/';
        }

        function goBack() {
            const returnUrl = getReturnUrl();
            window.location.href = returnUrl;
        }

        function showNotification(message, type = 'success') {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = \`notification \${type}\`;
            notification.style.display = 'block';
            
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }

        async function handlePayment(packageData) {
            try {
                console.log('Starting payment for package:', packageData);
                
                if (!userId) {
                    showNotification('로그인이 필요합니다.', 'error');
                    setTimeout(() => {
                        window.location.href = 'https://www.everyunse.com/auth';
                    }, 1500);
                    return;
                }

                // 세션 데이터 업데이트
                const updateResponse = await fetch('/api/update-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        userId: userId,
                        packageId: packageData.id,
                        amount: packageData.price,
                        coins: packageData.coins,
                        bonusCoins: packageData.bonusCoins || 0
                    })
                });

                const updateResult = await updateResponse.json();
                if (!updateResult.success) {
                    showNotification('세션 업데이트에 실패했습니다.', 'error');
                    return;
                }

                // KG 이니시스 Form 기반 결제 실행
                console.log('Starting KG Inicis form payment...');
                
                const merchantUid = 'EveryUnse_' + sessionId + '_' + Date.now();
                const timestamp = Date.now();
                
                // KG 이니시스 결제 Form 생성 및 제출
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = 'https://stgstdpay.inicis.com/inicis/std/stdpay.jsp';
                form.style.display = 'none';
                
                // 필수 파라미터들
                const params = {
                    'version': '1.0',
                    'mid': 'INIpayTest',
                    'goodname': packageData.name + ' 엽전 충전',
                    'oid': merchantUid,
                    'price': packageData.price,
                    'currency': 'WON',
                    'buyername': '엽전충전',
                    'buyertel': '010-0000-0000',
                    'buyeremail': 'test@test.com',
                    'timestamp': timestamp,
                    'signature': '',
                    'returnUrl': window.location.origin + '/payment-complete',
                    'closeUrl': window.location.origin + '/payment-cancel',
                    'acceptmethod': 'CARD',
                    'custom_data': JSON.stringify({
                        sessionId: sessionId,
                        userId: userId,
                        packageId: packageData.id,
                        coins: packageData.coins,
                        bonusCoins: packageData.bonusCoins || 0
                    })
                };
                
                // Signature 생성 (간단한 해시)
                const signData = 'oid=' + merchantUid + '&price=' + packageData.price + '&timestamp=' + timestamp;
                params.signature = btoa(signData); // Base64 인코딩
                
                // Form에 파라미터 추가
                Object.keys(params).forEach(key => {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    input.value = params[key];
                    form.appendChild(input);
                });
                
                document.body.appendChild(form);
                
                showNotification('KG 이니시스 결제 페이지로 이동합니다...');
                
                // Form 제출
                form.submit();
                
            } catch (error) {
                console.error('Payment error:', error);
                showNotification('결제 처리 중 오류가 발생했습니다.', 'error');
            }
        }

        async function renderPackages() {
            try {
                const packages = ${JSON.stringify(packages)};
                console.log('Packages data:', packages);
                
                const container = document.getElementById('packages-container');
                console.log('Container found:', container);
                
                if (!container) {
                    console.error('packages-container not found');
                    return;
                }
                
                if (!packages || packages.length === 0) {
                    console.error('No packages data available');
                    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #6b7280;">패키지 정보를 불러올 수 없습니다.</div>';
                    return;
                }
                
                container.innerHTML = packages.map((pkg, index) => \`
                    <div class="package-card \${index === 1 ? 'popular' : ''}" onclick="handlePayment(\${JSON.stringify(pkg).replace(/"/g, '&quot;')})">
                        <div class="package-icon">💰</div>
                        <div class="package-name">\${pkg.name}</div>
                        <div class="package-price">₩\${parseFloat(pkg.price).toLocaleString()}</div>
                        <button class="package-btn">구매하기</button>
                    </div>
                \`).join('');
                
                console.log('Packages rendered successfully');
            } catch (error) {
                console.error('Error rendering packages:', error);
                const container = document.getElementById('packages-container');
                if (container) {
                    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #ef4444;">패키지 로딩 중 오류가 발생했습니다.</div>';
                }
            }
        }

        // 페이지 로드 시 패키지 렌더링
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded, rendering packages...');
            renderPackages();
        });
    </script>
</body>
</html>
    `);
  } catch (error) {
    console.error('Error serving payment page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 세션 업데이트 엔드포인트
app.post('/api/update-session', (req, res) => {
  try {
    const { sessionId, userId, packageId, amount, coins, bonusCoins } = req.body;
    
    console.log('Updating session:', { sessionId, userId, packageId, amount, coins, bonusCoins });
    
    if (!sessionId || !userId || !packageId || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }
    
    // 세션 데이터 저장
    paymentSessions.set(sessionId, {
      sessionId,
      userId,
      packageId,
      amount,
      coins,
      bonusCoins: bonusCoins || 0,
      timestamp: Date.now()
    });
    
    console.log('Session updated successfully');
    res.json({ success: true });
    
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 세션 ID에서 추출하는 함수
function extractSessionFromOID(oid) {
  // OID 형식: EveryUnse_sessionId_timestamp
  const parts = oid.split('_');
  if (parts.length >= 2) {
    return parts[1]; // sessionId 부분 반환
  }
  return null;
}

// 메인 서비스에 결제 결과 알림
async function notifyMainService(sessionData, status) {
  try {
    const response = await axios.post(\`\${MAIN_SERVICE_URL}/api/payment/webhook\`, {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      bonusCoins: sessionData.bonusCoins,
      status: status,
      timestamp: Date.now()
    }, {
      headers: {
        'Authorization': \`Bearer \${WEBHOOK_SECRET}\`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Main service notification sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to notify main service:', error.message);
    throw error;
  }
}

// 웹훅 엔드포인트 (결제 완료 처리)
app.post('/webhook', async (req, res) => {
  try {
    const { imp_uid, merchant_uid, status, custom_data } = req.body;
    console.log('Received webhook:', { imp_uid, merchant_uid, status, custom_data });
    
    // merchant_uid에서 세션 ID 추출
    const sessionId = custom_data?.sessionId;
    if (!sessionId) {
      console.error('No sessionId in custom_data');
      return res.status(400).json({ success: false, error: 'No session ID' });
    }
    
    const sessionData = paymentSessions.get(sessionId);
    if (!sessionData) {
      console.error('Session not found:', sessionId);
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    if (status === 'paid') {
      // 메인 서비스에 결제 완료 알림
      try {
        await notifyMainService(sessionData, 'completed');
        
        // 세션 삭제
        paymentSessions.delete(sessionId);
        
        res.json({ success: true, message: 'Payment processed successfully' });
      } catch (error) {
        console.error('Failed to process payment:', error);
        res.status(500).json({ success: false, error: 'Failed to process payment' });
      }
    } else {
      res.json({ success: false, error: 'Payment not completed' });
    }
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// KG 이니시스 결제 완료 페이지
app.post('/payment-complete', async (req, res) => {
  const { P_STATUS, P_OID, P_AMT, P_TID, P_UNAME } = req.body;
  console.log('KG Inicis payment complete:', req.body);
  
  // P_OID에서 세션 ID 추출
  const sessionId = extractSessionFromOID(P_OID);
  
  try {
    if (P_STATUS === '00') { // 결제 성공
      if (sessionId) {
        const sessionData = paymentSessions.get(sessionId);
        if (sessionData) {
          // 메인 서비스에 결제 완료 알림
          await notifyMainService(sessionData, 'completed');
          paymentSessions.delete(sessionId);
        }
      }
      
      const returnUrl = getReturnUrl();
      res.send(\`
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>결제 완료</title>
          </head>
          <body>
            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
              <h2>결제가 완료되었습니다!</h2>
              <p>잠시 후 자동으로 이동합니다...</p>
              <script>
                setTimeout(() => {
                  window.location.href = '\${returnUrl}';
                }, 2000);
              </script>
            </div>
          </body>
        </html>
      \`);
    } else {
      const returnUrl = getReturnUrl();
      res.send(\`
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>결제 실패</title>
          </head>
          <body>
            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
              <h2>결제에 실패했습니다</h2>
              <p>다시 시도해주세요.</p>
              <script>
                setTimeout(() => {
                  window.location.href = '\${returnUrl}';
                }, 3000);
              </script>
            </div>
          </body>
        </html>
      \`);
    }
  } catch (error) {
    console.error('Payment completion error:', error);
    const returnUrl = getReturnUrl();
    res.send(\`
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>결제 오류</title>
        </head>
        <body>
          <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
            <h2>처리 중 오류가 발생했습니다</h2>
            <p>잠시 후 다시 시도해주세요.</p>
            <script>
              setTimeout(() => {
                window.location.href = '\${returnUrl}';
              }, 3000);
            </script>
          </div>
        </body>
      </html>
    \`);
  }
});

// KG 이니시스 결제 취소 페이지
app.get('/payment-cancel', (req, res) => {
  const returnUrl = getReturnUrl();
  res.send(\`
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>결제 취소</title>
      </head>
      <body>
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
          <h2>결제가 취소되었습니다</h2>
          <p>잠시 후 자동으로 이동합니다...</p>
          <script>
            setTimeout(() => {
              window.location.href = '\${returnUrl}';
            }, 2000);
          </script>
        </div>
      </body>
    </html>
  \`);
});

// 세션 정보 확인 엔드포인트 (디버깅용)
app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = paymentSessions.get(sessionId);
  
  if (sessionData) {
    res.json({ success: true, data: sessionData });
  } else {
    res.status(404).json({ success: false, error: 'Session not found' });
  }
});

app.listen(PORT, () => {
  console.log(\`Payment service running on port \${PORT}\`);
});
