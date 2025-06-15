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
    const { sessionId, userId, packageId, amount, coins, bonusCoins, returnUrl } = req.query;
    
    console.log('Received URL parameters:', { sessionId, userId, packageId, amount, coins, bonusCoins, returnUrl });
    
    // URL 파라미터로 받은 데이터를 세션에 저장
    let sessionData = null;
    if (sessionId && userId) {
      // packageId가 없는 경우 - 패키지 선택을 외부에서 하는 경우
      if (!packageId) {
        console.log('Creating session for package selection in external service');
        sessionData = {
          userId: userId,
          packageId: null, // 나중에 패키지 선택 시 업데이트
          returnUrl: returnUrl,
          timestamp: Date.now()
        };
      } else {
        // packageId가 있는 경우 - 기존 로직
        console.log('Creating session with specific package selection');
        sessionData = {
          userId: userId,
          packageId: parseInt(packageId),
          amount: parseFloat(amount),
          coins: parseInt(coins),
          bonusCoins: parseInt(bonusCoins) || 0,
          returnUrl: returnUrl,
          timestamp: Date.now()
        };
      }
      
      paymentSessions.set(sessionId, sessionData);
      console.log('Created session data from URL params:', sessionData);
    } else {
      console.log('No sessionId or userId provided, loading coin shop without session');
    }
    
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f9fafb;
            min-height: 100vh;
        }

        .container {
            max-width: 448px;
            margin: 0 auto;
            padding-bottom: 80px;
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
            padding: 4px;
            background: none;
            border: none;
            cursor: pointer;
            border-radius: 6px;
            transition: background-color 0.2s;
        }

        .back-btn:hover {
            background-color: #f3f4f6;
        }

        .header-title {
            font-size: 18px;
            font-weight: 600;
        }

        .coin-balance {
            background: linear-gradient(135deg, #ffd700, #ffa500);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
        }

        /* Hero Section */
        .hero-section {
            padding: 16px;
        }

        .hero-card {
            background: linear-gradient(135deg, #ffd700, #ffa500);
            color: white;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .hero-icon {
            width: 64px;
            height: 64px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            font-size: 32px;
        }

        .hero-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 8px;
        }

        .hero-subtitle {
            font-size: 14px;
            opacity: 0.9;
        }

        .hero-decoration {
            position: absolute;
            right: -16px;
            bottom: -16px;
            font-size: 64px;
            opacity: 0.2;
        }

        /* Packages Section */
        .packages-section {
            padding: 0 16px 24px;
        }

        .packages-title {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 16px;
        }

        .packages-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .package-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 16px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .package-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }

        .package-card.popular {
            border: 2px solid #8b5cf6;
        }

        .popular-badge {
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            background: #8b5cf6;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            z-index: 10;
        }

        .package-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 12px;
            color: white;
            font-size: 24px;
            font-weight: bold;
        }

        .package-icon.blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
        .package-icon.purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
        .package-icon.gold { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .package-icon.rose { background: linear-gradient(135deg, #ec4899, #be185d); }

        .package-name {
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 4px;
        }

        .package-coins {
            font-size: 24px;
            font-weight: bold;
            color: #8b5cf6;
            margin-bottom: 4px;
        }

        .package-coins-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 12px;
        }

        .package-bonus {
            font-size: 12px;
            color: #059669;
            font-weight: 500;
            margin-bottom: 12px;
        }

        .package-price {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 12px;
        }

        .package-btn {
            width: 100%;
            padding: 8px 16px;
            background: #8b5cf6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .package-btn:hover {
            background: #7c3aed;
            transform: scale(1.02);
        }

        .package-btn.popular {
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }

        /* Payment Info */
        .payment-info {
            padding: 0 16px 24px;
        }

        .payment-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 20px;
        }

        .payment-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
        }

        .payment-title {
            font-size: 18px;
            font-weight: 600;
        }

        .payment-methods {
            margin-bottom: 16px;
        }

        .payment-methods h4 {
            font-weight: 500;
            margin-bottom: 12px;
        }

        .payment-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 14px;
        }

        .payment-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .check-icon {
            color: #10b981;
        }

        .security-info {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 12px;
            font-size: 14px;
            color: #166534;
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
                            <span>카카오페이</span>
                        </div>
                        <div class="payment-item">
                            <span class="check-icon">✓</span>
                            <span>네이버페이</span>
                        </div>
                    </div>
                </div>
                
                <div class="security-info">
                    <strong>🔒 안전한 결제</strong><br>
                    모든 결제는 SSL로 암호화되어 안전하게 처리됩니다.
                </div>
            </div>
        </section>
    </div>

    <div class="notification" id="notification"></div>

    <script>
        const IMP = window.IMP;
        IMP.init('imp68124036');
        
        const sessionId = new URLSearchParams(window.location.search).get('sessionId');
        const userId = new URLSearchParams(window.location.search).get('userId');
        
        console.log('Session info:', { sessionId, userId });

        function showNotification(message, type = 'success') {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = 'notification ' + type;
            notification.style.display = 'block';
            
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }

        function goBack() {
            const returnUrl = getReturnUrl();
            window.location.href = returnUrl;
        }

        function getReturnUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('returnUrl') || 'https://www.everyunse.com/';
        }

        async function selectPackage(packageData) {
            console.log('Package selected:', packageData);
            
            if (!sessionId || !userId) {
                showNotification('세션 정보가 없습니다. 다시 시도해주세요.', 'error');
                return;
            }

            try {
                // 세션 데이터 업데이트
                const updateResponse = await fetch('/api/update-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId: sessionId,
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

                // Iamport 결제 실행
                IMP.request_pay({
                    pg: 'inicis_unified',
                    pay_method: 'card',
                    merchant_uid: 'EveryUnse_' + sessionId + '_' + Date.now(),
                    name: packageData.name + ' 엽전 충전',
                    amount: packageData.price,
                    buyer_email: '',
                    buyer_name: '엽전 충전',
                    buyer_tel: '',
                    buyer_addr: '',
                    buyer_postcode: '',
                    custom_data: {
                        sessionId: sessionId,
                        userId: userId,
                        packageId: packageData.id,
                        coins: packageData.coins,
                        bonusCoins: packageData.bonusCoins || 0
                    },
                    m_redirect_url: window.location.origin + '/payment-complete'
                }, function(rsp) {
                    console.log('Payment response:', rsp);
                    
                    if (rsp.success) {
                        showNotification('결제를 진행합니다...');
                        
                        // 결제 검증
                        fetch('/webhook', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                imp_uid: rsp.imp_uid,
                                merchant_uid: rsp.merchant_uid,
                                status: 'paid',
                                custom_data: rsp.custom_data
                            })
                        })
                        .then(response => response.json())
                        .then(data => {
                            console.log('Verification response:', data);
                            if (data.success) {
                                showNotification('결제가 완료되었습니다!');
                                setTimeout(() => {
                                    const returnUrl = getReturnUrl();
                                    window.location.href = returnUrl;
                                }, 1500);
                            } else {
                                showNotification('결제 검증 실패', 'error');
                            }
                        })
                        .catch(error => {
                            console.error('Verification error:', error);
                            showNotification('결제 검증 중 오류 발생', 'error');
                        });
                    } else {
                        showNotification('결제 실패: ' + rsp.error_msg, 'error');
                    }
                });
                
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
                
                packages.forEach((pkg, index) => {
                    console.log('Processing package:', pkg);
                    const isPopular = index === 1;
                    const iconClasses = ['blue', 'purple', 'gold', 'rose'];
                    const iconClass = iconClasses[index % iconClasses.length];
                    
                    const packageElement = document.createElement('div');
                    packageElement.className = 'package-card ' + (isPopular ? 'popular' : '');
                    packageElement.innerHTML = 
                        (isPopular ? '<div class="popular-badge">인기</div>' : '') +
                        '<div class="package-icon ' + iconClass + '">💰</div>' +
                        '<h4 class="package-name">' + pkg.name + '</h4>' +
                        '<div class="package-coins">' + pkg.coins.toLocaleString() + '</div>' +
                        '<div class="package-coins-label">엽전</div>' +
                        (pkg.bonusCoins > 0 ? '<div class="package-bonus">+' + pkg.bonusCoins + ' 보너스</div>' : '') +
                        '<div class="package-price">₩' + parseFloat(pkg.price).toLocaleString() + '</div>' +
                        '<button class="package-btn ' + (isPopular ? 'popular' : '') + '" onclick="selectPackage({id: ' + pkg.id + ', name: \\'' + pkg.name + '\\', coins: ' + pkg.coins + ', bonusCoins: ' + (pkg.bonusCoins || 0) + ', price: ' + parseFloat(pkg.price) + '})">구매하기</button>';
                    
                    container.appendChild(packageElement);
                    console.log('Package element added:', packageElement);
                });
                
                console.log('All packages rendered successfully');
                
            } catch (error) {
                console.error('Error rendering packages:', error);
                showNotification('패키지 로딩 중 오류가 발생했습니다.', 'error');
            }
        }

        document.addEventListener('DOMContentLoaded', renderPackages);
    </script>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error loading coin shop:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 세션 데이터 업데이트 엔드포인트
app.post('/api/update-session', (req, res) => {
  try {
    const { sessionId, packageId, amount, coins, bonusCoins } = req.body;
    console.log('Updating session data:', { sessionId, packageId, amount, coins, bonusCoins });
    
    const sessionData = paymentSessions.get(sessionId);
    if (sessionData) {
      sessionData.packageId = packageId;
      sessionData.amount = amount;
      sessionData.coins = coins;
      sessionData.bonusCoins = bonusCoins || 0;
      paymentSessions.set(sessionId, sessionData);
      console.log('Session updated successfully:', sessionData);
      res.json({ success: true });
    } else {
      console.log('Session not found for ID:', sessionId);
      res.status(404).json({ success: false, error: 'Session not found' });
    }
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// OID에서 세션 ID 추출
function extractSessionFromOID(oid) {
  const parts = oid.split('_');
  if (parts.length >= 2) {
    return parts[1] + '_' + parts[2];
  }
  return null;
}

// 메인 서비스에 결제 결과 알림
async function notifyMainService(sessionData, status) {
  try {
    const response = await axios.post(`${MAIN_SERVICE_URL}/api/webhook/payment`, {
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      bonusCoins: sessionData.bonusCoins,
      status: status,
      timestamp: Date.now()
    }, {
      headers: {
        'Authorization': `Bearer ${WEBHOOK_SECRET}`,
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

// 결제 완료 페이지 (모바일 리다이렉트용)
app.get('/payment-complete', (req, res) => {
  const { imp_uid, merchant_uid, imp_success } = req.query;
  
  if (imp_success === 'true') {
    res.send(`
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
                window.location.href = 'https://www.everyunse.com/';
              }, 2000);
            </script>
          </div>
        </body>
      </html>
    `);
  } else {
    res.send(`
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
                window.location.href = 'https://www.everyunse.com/';
              }, 3000);
            </script>
          </div>
        </body>
      </html>
    `);
  }
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
  console.log(`Payment service running on port ${PORT}`);
});
