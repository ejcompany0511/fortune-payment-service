const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 메모리 저장소 (간단한 세션 관리용)
const paymentSessions = new Map();

app.use(cors({
  origin: ['https://www.everyunse.com', 'https://everyunse.com'],
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// KG Inicis 설정
const INICIS_MID = process.env.INICIS_MID || 'INIpayTest';
const INICIS_SIGNKEY = process.env.INICIS_SIGNKEY || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS';
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://www.everyunse.com';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'EveryUnse2024PaymentSecureWebhook!@#';

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 결제 요청 생성 (PC/모바일 자동 감지)
app.post('/api/create-payment', (req, res) => {
  const { amount, coins, userId, packageId } = req.body;
  
  if (!amount || !coins) {
    return res.status(400).json({ error: 'Amount and coins are required' });
  }

  // User-Agent로 모바일/PC 감지
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  // 세션 ID 생성
  const sessionId = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString().replace(/[:\-]/g, '').slice(0, 14);
  const orderId = `ORDER_${timestamp}_${sessionId.slice(0, 8)}`;

  // 결제 세션 정보 저장
  paymentSessions.set(sessionId, {
    amount,
    coins,
    userId,
    packageId,
    orderId,
    paymentType: isMobile ? 'mobile' : 'pc',
    status: 'pending',
    createdAt: new Date()
  });

  if (isMobile) {
    // 모바일 결제 파라미터 (최신 Smart 결제 시스템)
    const paymentParams = {
      P_INI_PAYMENT: 'CARD',
      P_MID: INICIS_MID,
      P_OID: orderId,
      P_AMT: amount,
      P_GOODS: `${coins}코인 패키지`,
      P_UNAME: '고객',
      P_MOBILE: 'YES',
      P_CHARSET: 'utf8',
      P_SESSIONID: sessionId,
      P_NOTI_URL: `${req.protocol}://${req.get('host')}/api/mobile-payment-complete`,
      P_NEXT_URL: `${req.protocol}://${req.get('host')}/api/mobile-payment-complete`,
      P_RESERVED: 'twotrs_isp=Y&block_isp=Y'
    };

    res.json({
      success: true,
      sessionId,
      paymentType: 'mobile',
      paymentUrl: 'https://mobile.inicis.com/smart/payment/',
      params: paymentParams
    });
  } else {
    // PC 결제 - 테스트 환경에서는 시뮬레이션 모드로 전환
    const isTestMode = process.env.NODE_ENV !== 'production';
    
    if (isTestMode) {
      // 테스트 모드에서는 바로 성공 처리
      setTimeout(async () => {
        await notifyMainService(paymentSessions.get(sessionId), 'completed');
      }, 1000);
      
      res.json({
        success: true,
        sessionId,
        paymentType: 'pc',
        testMode: true,
        message: '테스트 환경에서 결제가 시뮬레이션됩니다.'
      });
    } else {
      // 프로덕션 환경에서는 최신 KG Inicis PC 결제
      const pcPaymentParams = {
        P_MID: INICIS_MID,
        P_OID: orderId,
        P_AMT: amount,
        P_GOODS: `${coins}코인 패키지`,
        P_UNAME: '고객',
        P_NEXT_URL: `${req.protocol}://${req.get('host')}/api/pc-payment-complete`,
        P_NOTI_URL: `${req.protocol}://${req.get('host')}/api/pc-payment-complete`,
        P_CHARSET: 'utf8',
        P_INI_PAYMENT: 'CARD',
        P_SESSIONID: sessionId
      };
      
      res.json({
        success: true,
        sessionId,
        paymentType: 'pc',
        paymentUrl: 'https://stdpay.inicis.com/inicis/std/payView.jsp',
        params: pcPaymentParams
      });
    }
  }
});

// 모바일 결제 완료 처리
app.post('/api/mobile-payment-complete', async (req, res) => {
  const { P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID } = req.body;

  console.log('Mobile payment completion received:', {
    P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID
  });

  const sessionData = paymentSessions.get(P_SESSIONID);
  
  if (!sessionData) {
    console.error('Session not found:', P_SESSIONID);
    return res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=session_not_found`);
  }

  if (P_STATUS === '00') {
    // 결제 성공
    sessionData.status = 'completed';
    sessionData.transactionId = P_TID;
    await notifyMainService(sessionData, 'completed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=success&coins=${sessionData.coins}`);
  } else {
    // 결제 실패
    sessionData.status = 'failed';
    sessionData.errorMessage = P_RMESG1;
    await notifyMainService(sessionData, 'failed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=${encodeURIComponent(P_RMESG1)}`);
  }
});

// PC 결제 완료 처리
app.post('/api/pc-payment-complete', async (req, res) => {
  const { P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID } = req.body;

  console.log('PC payment completion received:', {
    P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID
  });

  // sessionId가 없으면 P_OID에서 추출
  const sessionId = P_SESSIONID || extractSessionFromOID(P_OID);
  const sessionData = paymentSessions.get(sessionId);
  
  if (!sessionData) {
    console.error('Session not found:', sessionId);
    return res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=session_not_found`);
  }

  if (P_STATUS === '00') {
    // 결제 성공
    sessionData.status = 'completed';
    sessionData.transactionId = P_TID;
    await notifyMainService(sessionData, 'completed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=success&coins=${sessionData.coins}`);
  } else {
    // 결제 실패
    sessionData.status = 'failed';
    sessionData.errorMessage = P_RMESG1;
    await notifyMainService(sessionData, 'failed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=${encodeURIComponent(P_RMESG1)}`);
  }
});

// OID에서 sessionId 추출 헬퍼 함수
function extractSessionFromOID(oid) {
  if (!oid) return null;
  const parts = oid.split('_');
  return parts.length >= 3 ? parts[2] : null;
}

// 메인 서비스에 결제 결과 알림
async function notifyMainService(sessionData, status) {
  try {
    const webhookUrl = `${MAIN_SERVICE_URL}/api/payment-webhook`;
    const webhookData = {
      sessionId: sessionData.sessionId || crypto.randomBytes(16).toString('hex'),
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      status: status,
      transactionId: sessionData.transactionId,
      timestamp: new Date().toISOString()
    };

    // 웹훅 서명 생성
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(webhookData))
      .digest('hex');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      console.error('Failed to notify main service:', response.status, await response.text());
    } else {
      console.log('Successfully notified main service');
    }
  } catch (error) {
    console.error('Error notifying main service:', error);
  }
}

// 결제 세션 조회
app.get('/api/payment-session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = paymentSessions.get(sessionId);
  
  if (!sessionData) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(sessionData);
});

// 오래된 세션 정리 (1시간 이상)
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [sessionId, sessionData] of paymentSessions.entries()) {
    if (sessionData.createdAt < oneHourAgo) {
      paymentSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // 1시간마다 실행

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Main service URL: ${MAIN_SERVICE_URL}`);
});
