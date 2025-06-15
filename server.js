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
            notification.className = \`notification \${type}\`;
            notification.style.display = 'block';
            
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }

        function getReturnUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('returnUrl') || 'https://www.everyunse.com';
        }

        function goBack() {
            const returnUrl = getReturnUrl();
            window.location.href = returnUrl;
        }

        async function selectPackage(packageData) {
            if (!sessionId || !userId) {
                showNotification('세션 정보가 없습니다. 다시 시도해주세요.', 'error');
                return;
            }

            try {
                console.log('Selecting package:', packageData);
                
                // 세션 데이터 업데이트
                const updateResponse = await fetch('/api/update-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        packageId: packageData.id,
                        amount: packageData.price,
                        coins: packageData.coins,
                        bonusCoins: packageData.bonusCoins || 0
                    })
                });

                if (!updateResponse.ok) {
                    throw new Error('세션 업데이트 실패');
                }

                console.log('Session updated, starting payment...');
                
                // 아임포트 결제 시작
                const merchant_uid = \`oid_\${sessionId}_\${Date.now()}\`;
                
                IMP.request_pay({
                    pg: 'kakaopay.TC0ONETIME',
                    pay_method: 'card',
                    merchant_uid: merchant_uid,
                    name: packageData.name,
                    amount: packageData.price,
                    buyer_name: '고객',
                    buyer_email: 'customer@example.com'
                }, function(rsp) {
                    console.log('Payment response:', rsp);
                    
                    if (rsp.success) {
                        fetch('/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                imp_uid: rsp.imp_uid,
                                merchant_uid: rsp.merchant_uid,
                                sessionId: sessionId,
                                success: true
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
                        '<div class="package-price">₩' + pkg.price.toLocaleString() + '</div>' +
                        '<button class="package-btn ' + (isPopular ? 'popular' : '') + '" onclick="selectPackage({id: ' + pkg.id + ', name: \\'' + pkg.name + '\\', coins: ' + pkg.coins + ', bonusCoins: ' + (pkg.bonusCoins || 0) + ', price: ' + pkg.price + '})">구매하기</button>';
                    
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

// sessionId에서 추출하는 함수
function extractSessionFromOID(oid) {
  // oid_sessionId_timestamp 형태에서 sessionId 추출
  const parts = oid.split('_');
  if (parts.length >= 3) {
    // 첫 번째 'oid'를 제거하고 마지막 timestamp를 제거
    return parts.slice(1, -1).join('_');
  }
  return null;
}

// 메인 서비스에 결제 완료 알림
async function notifyMainService(sessionData, status) {
  try {
    const webhookUrl = `${MAIN_SERVICE_URL}/api/payment/webhook`;
    console.log('Sending webhook to:', webhookUrl);
    console.log('Session data for webhook:', sessionData);
    
    const response = await axios.post(webhookUrl, {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      bonusCoins: sessionData.bonusCoins || 0,
      status: status,
      timestamp: Date.now()
    }, {
      headers: {
        'Authorization': `Bearer ${WEBHOOK_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Webhook response:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to notify main service:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.status, error.response.data);
    }
    throw error;
  }
}

// 아임포트 결제 검증 API
app.post('/verify-payment', async (req, res) => {
  const { imp_uid, merchant_uid, sessionId, success, error_msg } = req.body;

  console.log('Payment verification received:', {
    imp_uid, merchant_uid, sessionId, success, error_msg
  });

  if (!success) {
    return res.json({
      success: false,
      error: error_msg || '결제 실패',
      redirectUrl: `${MAIN_SERVICE_URL}?payment=error&message=payment_cancelled`
    });
  }

  // sessionId를 직접 사용하거나 merchant_uid에서 추출
  let finalSessionId = sessionId;
  if (!finalSessionId && merchant_uid) {
    finalSessionId = extractSessionFromOID(merchant_uid);
  }
  
  console.log('Looking for sessionId:', finalSessionId);
  console.log('Available sessions:', Array.from(paymentSessions.keys()));

  if (!finalSessionId) {
    console.error('No sessionId available');
    return res.json({
      success: false,
      error: 'Session ID not found',
      redirectUrl: `${MAIN_SERVICE_URL}?payment=error&message=session_not_found`
    });
  }

  const sessionData = paymentSessions.get(finalSessionId);
  if (!sessionData) {
    console.error('Session not found for ID:', finalSessionId);
    return res.json({
      success: false,
      error: 'Session not found',
      redirectUrl: `${MAIN_SERVICE_URL}?payment=error&message=session_not_found`
    });
  }

  console.log('Found session data:', sessionData);

  try {
    // 메인 서비스에 결제 완료 알림
    const webhookData = {
      ...sessionData,
      sessionId: finalSessionId,
      transactionId: imp_uid,
      merchantUid: merchant_uid
    };
    
    await notifyMainService(webhookData, 'success');
    
    // 세션 정리
    paymentSessions.delete(finalSessionId);
    
    // 성공 응답과 함께 리다이렉트 URL 제공
    const returnUrl = sessionData.returnUrl || `${MAIN_SERVICE_URL}`;
    res.json({
      success: true,
      message: '결제가 성공적으로 완료되었습니다',
      redirectUrl: `${returnUrl}?payment=success&coins=${sessionData.coins}`
    });
    
  } catch (error) {
    console.error('Error processing payment completion:', error);
    res.json({
      success: false,
      error: '결제 처리 중 오류가 발생했습니다',
      redirectUrl: `${MAIN_SERVICE_URL}?payment=error&message=processing_failed`
    });
  }
});

// KG Inicis 결제 결과 처리
app.post('/inicis/return', async (req, res) => {
  console.log('KG Inicis return received:', req.body);
  
  const { P_STATUS, P_RMESG1, P_TID, P_OID } = req.body;
  
  // P_OID에서 sessionId 추출
  const sessionId = extractSessionFromOID(P_OID);
  
  if (!sessionId) {
    console.error('Cannot extract sessionId from P_OID:', P_OID);
    return res.redirect(`${MAIN_SERVICE_URL}?payment=error&message=invalid_order_id`);
  }
  
  const sessionData = paymentSessions.get(sessionId);
  if (!sessionData) {
    console.error('Session not found for extracted sessionId:', sessionId);
    return res.redirect(`${MAIN_SERVICE_URL}?payment=error&message=session_not_found`);
  }

  try {
    if (P_STATUS === '00') {
      // 결제 성공
      console.log('KG Inicis payment successful:', { P_TID, P_OID, sessionId });
      
      const webhookData = {
        ...sessionData,
        sessionId: sessionId,
        transactionId: P_TID,
        merchantUid: P_OID
      };
      
      await notifyMainService(webhookData, 'success');
      
      // 세션 정리
      paymentSessions.delete(sessionId);
      
      const returnUrl = sessionData.returnUrl || `${MAIN_SERVICE_URL}`;
      res.redirect(`${returnUrl}?payment=success&coins=${sessionData.coins}`);
      
    } else {
      // 결제 실패
      console.log('KG Inicis payment failed:', { P_STATUS, P_RMESG1, P_OID });
      
      const webhookData = {
        ...sessionData,
        sessionId: sessionId,
        error: P_RMESG1
      };
      
      await notifyMainService(webhookData, 'failed');
      
      // 세션 정리
      paymentSessions.delete(sessionId);
      
      const returnUrl = sessionData.returnUrl || `${MAIN_SERVICE_URL}`;
      res.redirect(`${returnUrl}?payment=error&message=${encodeURIComponent(P_RMESG1)}`);
    }
    
  } catch (error) {
    console.error('Error processing KG Inicis return:', error);
    const returnUrl = sessionData.returnUrl || `${MAIN_SERVICE_URL}`;
    res.redirect(`${returnUrl}?payment=error&message=processing_failed`);
  }
});

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
  console.log('Environment:', {
    INICIS_MID,
    MAIN_SERVICE_URL,
    NODE_ENV: process.env.NODE_ENV
  });
});
