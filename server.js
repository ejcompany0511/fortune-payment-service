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

// 결제 생성 API (메인 서버에서 호출)
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount, coins, userId, packageId, sessionId } = req.body;
    console.log('Payment creation request:', { amount, coins, userId, packageId, sessionId });
    
    // 결제 세션을 메모리에 저장
    paymentSessions.set(sessionId, {
      userId,
      packageId,
      amount,
      coins,
      timestamp: Date.now()
    });
    
    console.log('Stored payment session:', sessionId, { userId, packageId, amount, coins });
    
    res.json({
      success: true,
      sessionId: sessionId,
      redirectUrl: `${req.protocol}://${req.get('host')}/?sessionId=${sessionId}&returnUrl=${encodeURIComponent(req.body.returnUrl || 'https://everyunse.com')}`
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// 메인 엽전 상점 페이지
app.get('/', async (req, res) => {
  try {
    const packages = await getCoinPackages();
    const sessionId = req.query.sessionId;
    
    // URL에서 sessionId 확인하여 세션 데이터 가져오기
    let sessionData = null;
    if (sessionId) {
      sessionData = paymentSessions.get(sessionId);
      console.log('Retrieved session data for page load:', sessionData);
    }

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>엽전 상점 - EveryUnse</title>
    <script src="https://cdn.iamport.kr/v1/iamport.js"></script>
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

        .main {
            padding-bottom: 80px;
        }

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

        <main class="main">
            <section class="hero">
                <div class="hero-card">
                    <div class="hero-icon">💰</div>
                    <h2 class="hero-title">엽전 충전하기</h2>
                    <p class="hero-description">더 많은 운세를 확인하려면 엽전이 필요해요</p>
                </div>
            </section>

            <section class="packages-section">
                <h2 class="section-title">엽전 패키지</h2>
                <div class="packages-grid" id="packagesGrid">
                    <!-- 패키지들이 동적으로 로드됩니다 -->
                </div>
            </section>
        </main>

        <button class="purchase-btn" id="purchaseBtn" onclick="handlePurchase()">
            구매하기
        </button>

        <div class="notification" id="notification">
            <span id="notificationText"></span>
        </div>
    </div>

    <script>
        let selectedPackage = null;
        const packages = ${JSON.stringify(packages)};
        const sessionData = ${JSON.stringify(sessionData)};
        
        console.log('Session data:', sessionData);

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

        function selectPackage(packageId) {
            selectedPackage = packages.find(p => p.id === packageId);
            
            document.querySelectorAll('.package-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            event.currentTarget.classList.add('selected');
            
            const purchaseBtn = document.getElementById('purchaseBtn');
            purchaseBtn.classList.add('show');
            purchaseBtn.textContent = \`\${selectedPackage.name} 구매하기 (\${Math.floor(selectedPackage.price).toLocaleString()}원)\`;
        }

        async function handlePurchase() {
            if (!selectedPackage) {
                showNotification('패키지를 선택해주세요');
                return;
            }

            showNotification('결제를 준비하고 있습니다...');

            try {
                // URL에서 sessionId 가져오기 (메인 서버에서 전달된 값)
                const urlParams = new URLSearchParams(window.location.search);
                const sessionId = urlParams.get('sessionId') || 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const merchant_uid = 'ORDER_' + Date.now() + Math.random().toString(36).substr(2, 5);
                
                console.log('Using sessionId from URL:', sessionId);
                console.log('Session data available:', sessionData);
                
                // 세션에 패키지 정보 업데이트 (사용자가 다른 패키지를 선택했을 수 있음)
                if (sessionId) {
                    try {
                        await fetch('/api/update-session', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: sessionId,
                                packageId: selectedPackage.id,
                                amount: selectedPackage.price,
                                coins: selectedPackage.coins + (selectedPackage.bonusCoins || 0)
                            })
                        });
                        console.log('Session updated on server');
                    } catch (error) {
                        console.error('Failed to update session:', error);
                    }
                }
                
                initializePayment(selectedPackage, sessionId, merchant_uid);
                
            } catch (error) {
                console.error('Purchase error:', error);
                showNotification('결제 시작 중 오류가 발생했습니다');
            }
        }

        function getReturnUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('returnUrl') || 'https://everyunse.com';
        }

        function goBack() {
            const returnUrl = getReturnUrl();
            window.location.href = returnUrl;
        }

        function showNotification(message) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        if (window.IMP) {
            window.IMP.init('imp57573124');
        }

        function initializePayment(packageData, sessionId, merchant_uid) {
            if (!window.IMP) {
                showNotification('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
                return;
            }
            
            window.IMP.request_pay({
                pg: 'html5_inicis',
                pay_method: 'card',
                merchant_uid: merchant_uid,
                name: packageData.name,
                amount: packageData.price,
                buyer_email: 'customer@example.com',
                buyer_name: '고객',
                buyer_tel: '010-1234-5678',
                buyer_addr: '서울특별시 강남구 삼성동',
                buyer_postcode: '123-456',
                m_redirect_url: window.location.origin + '/payment/complete?sessionId=' + sessionId + '&returnUrl=' + encodeURIComponent(getReturnUrl())
            }, function (rsp) {
                if (rsp.success) {
                    fetch('/verify-payment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            imp_uid: rsp.imp_uid,
                            merchant_uid: rsp.merchant_uid,
                            sessionId: sessionId,
                            success: true
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showNotification('결제가 완료되었습니다!');
                            setTimeout(() => {
                                const returnUrl = getReturnUrl();
                                window.location.href = returnUrl;
                            }, 1500);
                        } else {
                            showNotification('결제 검증 실패');
                        }
                    })
                    .catch(error => {
                        console.error('Verification error:', error);
                        showNotification('결제 검증 중 오류 발생');
                    });
                } else {
                    showNotification('결제 실패: ' + rsp.error_msg);
                }
            });
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
    const { sessionId, packageId, amount, coins } = req.body;
    console.log('Updating session data:', { sessionId, packageId, amount, coins });
    
    const sessionData = paymentSessions.get(sessionId);
    if (sessionData) {
      sessionData.packageId = packageId;
      sessionData.amount = amount;
      sessionData.coins = coins;
      paymentSessions.set(sessionId, sessionData);
      console.log('Session updated successfully:', sessionData);
      res.json({ success: true });
    } else {
      console.error('Session not found:', sessionId);
      res.status(404).json({ success: false, error: 'Session not found' });
    }
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, error: 'Failed to update session' });
  }
});

// 결제 검증 엔드포인트
app.post('/verify-payment', async (req, res) => {
  try {
    const { imp_uid, merchant_uid, sessionId, success } = req.body;
    console.log('Payment verification request:', { imp_uid, merchant_uid, sessionId, success });

    if (!success) {
      return res.json({ success: false, message: '결제가 취소되었습니다.' });
    }

    // 세션에서 사용자 정보 가져오기
    const sessionData = paymentSessions.get(sessionId);
    console.log('Retrieved session data:', sessionData);

    // 메인 서비스에 웹훅 전송
    const webhookData = {
      sessionId: sessionId,
      transactionId: imp_uid,
      merchantUid: merchant_uid,
      status: 'completed',
      amount: sessionData?.amount || req.body.amount || 0,
      coins: sessionData?.coins || req.body.coins || 0,
      bonusCoins: req.body.bonusCoins || 0,
      userId: sessionData?.userId,
      packageId: sessionData?.packageId
    };

    console.log('Sending webhook data:', webhookData);

    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(webhookData))
      .digest('hex');

    try {
      await axios.post(`${MAIN_SERVICE_URL}/api/payment/webhook`, webhookData, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        timeout: 10000
      });
      console.log('Webhook sent successfully');
    } catch (webhookError) {
      console.error('Webhook error:', webhookError.message);
    }

    // 세션 정리
    paymentSessions.delete(sessionId);

    res.json({ success: true, message: '결제가 완료되었습니다.' });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.json({ success: false, message: '결제 검증 중 오류가 발생했습니다.' });
  }
});

// 모바일 결제 완료 콜백
app.get('/payment/complete', (req, res) => {
  const { imp_uid, merchant_uid, imp_success, sessionId, returnUrl } = req.query;
  console.log('Mobile payment callback:', { imp_uid, merchant_uid, imp_success, sessionId });

  const decodedReturnUrl = returnUrl ? decodeURIComponent(returnUrl) : 'https://everyunse.com';

  if (imp_success === 'true') {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>결제 완료</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
              .success { color: #22c55e; font-size: 24px; margin-bottom: 20px; }
          </style>
      </head>
      <body>
          <div class="success">✅ 결제가 완료되었습니다!</div>
          <p>잠시 후 자동으로 이동합니다...</p>
          <script>
              // 결제 검증 요청
              fetch('/verify-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      imp_uid: '${imp_uid}',
                      merchant_uid: '${merchant_uid}',
                      sessionId: '${sessionId}',
                      success: true
                  })
              }).finally(() => {
                  setTimeout(() => {
                      window.location.href = '${decodedReturnUrl}';
                  }, 2000);
              });
          </script>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>결제 취소</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
              .error { color: #ef4444; font-size: 24px; margin-bottom: 20px; }
          </style>
      </head>
      <body>
          <div class="error">❌ 결제가 취소되었습니다</div>
          <p>잠시 후 자동으로 이동합니다...</p>
          <script>
              setTimeout(() => {
                  window.location.href = '${decodedReturnUrl}';
              }, 2000);
          </script>
      </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
  console.log(`Main service URL: ${MAIN_SERVICE_URL}`);
  console.log(`Webhook secret configured: ${WEBHOOK_SECRET ? 'Yes' : 'No'}`);
});
