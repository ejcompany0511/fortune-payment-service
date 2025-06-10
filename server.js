const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 메모리 저장소 (간단한 세션 관리용)
const paymentSessions = new Map();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// KG Inicis 설정
const INICIS_MID = process.env.INICIS_MID || 'INIpayTest';
const INICIS_SIGNKEY = process.env.INICIS_SIGNKEY || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS';
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://www.everyunse.com';

// 결제 요청 생성 (PC/모바일 자동 감지)
app.post('/api/create-payment', (req, res) => {
  const { amount, coins, userId, paymentType } = req.body;
  
  if (!amount || !coins) {
    return res.status(400).json({ error: 'Amount and coins are required' });
  }

  // User-Agent로 모바일/PC 감지 또는 명시적 paymentType 사용
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = paymentType === 'mobile' || 
    /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  // 세션 ID 생성
  const sessionId = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString().replace(/[:\-]/g, '').slice(0, 14);
  const orderId = `ORDER_${timestamp}_${sessionId.slice(0, 8)}`;

  // 결제 세션 정보 저장
  paymentSessions.set(sessionId, {
    amount,
    coins,
    userId,
    orderId,
    paymentType: isMobile ? 'mobile' : 'pc',
    status: 'pending',
    createdAt: new Date()
  });

  if (isMobile) {
    // 모바일 결제 파라미터
    const paymentParams = {
      P_NEXT_URL: `${req.protocol}://${req.get('host')}/api/mobile-payment-complete`,
      P_NOTI_URL: `${req.protocol}://${req.get('host')}/api/mobile-payment-noti`,
      P_RETURN_URL: `${MAIN_SERVICE_URL}/coins?payment=success`,
      P_CANCEL_URL: `${MAIN_SERVICE_URL}/coins?payment=cancelled`,
      P_MID: INICIS_MID,
      P_OID: orderId,
      P_AMT: amount,
      P_UNAME: '고객',
      P_GOODS: `${coins}코인 패키지`,
      P_MOBILE: 'YES',
      P_CHARSET: 'utf8',
      P_SESSIONID: sessionId
    };

    res.json({
      success: true,
      sessionId,
      paymentType: 'mobile',
      paymentUrl: 'https://mobile.inicis.com/smart/payment/',
      params: paymentParams
    });
  } else {
    // PC 결제 파라미터 (channelKey 방식)
    const channelKey = process.env.INICIS_CHANNEL_KEY || 'channel-key-bc5e12b1-11b3-4645-9033-1275c22d95cf';
    
    res.json({
      success: true,
      sessionId,
      paymentType: 'pc',
      channelKey: channelKey,
      paymentData: {
        paymentId: orderId,
        orderName: `${coins}코인 패키지`,
        amount: amount,
        currency: 'KRW',
        channelKey: channelKey,
        payMethod: 'card',
        returnUrl: `${req.protocol}://${req.get('host')}/api/pc-payment-complete`,
        sessionId: sessionId
      }
    });
  }
});

// KG Inicis 결제 완료 처리
app.post('/api/mobile-payment-complete', (req, res) => {
  const { P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID } = req.body;

  console.log('Payment completion received:', {
    P_STATUS,
    P_RMESG1,
    P_TID,
    P_AMT,
    P_MID,
    P_OID,
    P_SESSIONID
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
    sessionData.completedAt = new Date();
    
    // 메인 서비스로 결제 완료 알림
    notifyMainService(sessionData, 'completed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=success&coins=${sessionData.coins}&session=${P_SESSIONID}`);
  } else {
    // 결제 실패
    sessionData.status = 'failed';
    sessionData.errorMessage = P_RMESG1;
    
    notifyMainService(sessionData, 'failed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=failed&message=${encodeURIComponent(P_RMESG1)}`);
  }
});

// KG Inicis 알림 처리 (백그라운드)
app.post('/api/mobile-payment-noti', (req, res) => {
  const { P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID } = req.body;

  console.log('Payment notification received:', {
    P_STATUS,
    P_RMESG1,
    P_TID,
    P_AMT,
    P_MID,
    P_OID,
    P_SESSIONID
  });

  const sessionData = paymentSessions.get(P_SESSIONID);
  
  if (sessionData && P_STATUS === '00') {
    sessionData.status = 'completed';
    sessionData.transactionId = P_TID;
    sessionData.completedAt = new Date();
    
    // 메인 서비스로 결제 완료 알림
    notifyMainService(sessionData, 'completed');
  }

  res.send('OK');
});

// PC 결제 완료 처리 (channelKey 방식)
app.post('/api/pc-payment-complete', (req, res) => {
  const { success, paymentId, txId, amount, sessionId } = req.body;

  console.log('PC Payment completion received:', {
    success,
    paymentId,
    txId,
    amount,
    sessionId
  });

  const sessionData = paymentSessions.get(sessionId);
  
  if (!sessionData) {
    console.error('Session not found:', sessionId);
    return res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=session_not_found`);
  }

  if (success === 'true' || success === true) {
    // 결제 성공
    sessionData.status = 'completed';
    sessionData.transactionId = txId;
    sessionData.completedAt = new Date();
    
    // 메인 서비스로 결제 완료 알림
    notifyMainService(sessionData, 'completed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=success&coins=${sessionData.coins}&session=${sessionId}`);
  } else {
    // 결제 실패
    sessionData.status = 'failed';
    sessionData.errorMessage = 'PC payment failed';
    
    notifyMainService(sessionData, 'failed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=failed&message=payment_failed`);
  }
});

// 결제 상태 조회
app.get('/api/payment-status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = paymentSessions.get(sessionId);
  
  if (!sessionData) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    sessionId,
    status: sessionData.status,
    amount: sessionData.amount,
    coins: sessionData.coins,
    transactionId: sessionData.transactionId,
    createdAt: sessionData.createdAt,
    completedAt: sessionData.completedAt
  });
});

// 메인 서비스로 결제 완료 알림
async function notifyMainService(sessionData, status) {
  try {
    const notificationData = {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      status: status,
      transactionId: sessionData.transactionId,
      completedAt: sessionData.completedAt
    };

    // 메인 서비스의 웹훅 엔드포인트로 알림 전송
    const response = await fetch(`${MAIN_SERVICE_URL}/api/payment-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBHOOK_SECRET || 'default-secret'}`
      },
      body: JSON.stringify(notificationData)
    });

    if (response.ok) {
      console.log('Payment notification sent to main service successfully');
    } else {
      console.error('Failed to notify main service:', response.status);
    }
  } catch (error) {
    console.error('Error notifying main service:', error);
  }
}

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 세션 정리 (24시간 후 자동 삭제)
setInterval(() => {
  const now = new Date();
  for (const [sessionId, sessionData] of paymentSessions.entries()) {
    const sessionAge = now - sessionData.createdAt;
    if (sessionAge > 24 * 60 * 60 * 1000) { // 24시간
      paymentSessions.delete(sessionId);
      console.log(`Deleted expired session: ${sessionId}`);
    }
  }
}, 60 * 60 * 1000); // 1시간마다 정리

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Main service URL: ${MAIN_SERVICE_URL}`);
});
