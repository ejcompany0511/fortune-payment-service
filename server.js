const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Environment variables
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://your-replit-app.replit.app';
const IMP_KEY = process.env.IMP_KEY;
const IMP_SECRET = process.env.IMP_SECRET;

// Payment sessions storage
const paymentSessions = new Map();

// Get payment session data from main service
async function getPaymentSession(sessionId) {
  try {
    const response = await axios.get(`${MAIN_SERVICE_URL}/api/payment/session/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get payment session:', error);
    return null;
  }
}

// Payment page route
app.get('/payment', async (req, res) => {
  try {
    const { session: sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).render('error', { 
        message: '잘못된 결제 요청입니다.',
        returnUrl: MAIN_SERVICE_URL 
      });
    }

    const sessionData = await getPaymentSession(sessionId);
    
    if (!sessionData) {
      return res.status(404).render('error', { 
        message: '결제 세션을 찾을 수 없습니다.',
        returnUrl: MAIN_SERVICE_URL 
      });
    }

    const merchantUid = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    paymentSessions.set(merchantUid, {
      ...sessionData,
      sessionId,
      merchantUid,
      createdAt: new Date()
    });

    res.render('payment', {
      sessionData,
      merchantUid,
      impKey: process.env.IMP_KEY,
      returnUrl: sessionData.returnUrl || MAIN_SERVICE_URL
    });

  } catch (error) {
    console.error('Payment page error:', error);
    res.status(500).render('error', { 
      message: '결제 페이지 로드 중 오류가 발생했습니다.',
      returnUrl: MAIN_SERVICE_URL 
    });
  }
});

// Payment verification
app.post('/payment/verify', async (req, res) => {
  try {
    const { imp_uid, merchant_uid, imp_success } = req.body;
    
    if (!merchant_uid || !paymentSessions.has(merchant_uid)) {
      return res.status(400).json({ 
        success: false, 
        message: '결제 정보를 찾을 수 없습니다.' 
      });
    }

    const sessionData = paymentSessions.get(merchant_uid);
    
    if (imp_success === 'true' && imp_uid) {
      const tokenResponse = await axios.post('https://api.iamport.kr/users/getToken', {
        imp_key: IMP_KEY,
        imp_secret: IMP_SECRET
      });

      if (tokenResponse.data.code !== 0) {
        throw new Error('Failed to get access token');
      }

      const access_token = tokenResponse.data.response.access_token;

      const paymentResponse = await axios.get(
        `https://api.iamport.kr/payments/${imp_uid}`,
        {
          headers: { Authorization: access_token }
        }
      );

      const payment = paymentResponse.data.response;
      
      if (payment.amount !== sessionData.amount) {
        throw new Error('Payment amount mismatch');
      }

      if (payment.status === 'paid') {
        await axios.post(`${MAIN_SERVICE_URL}/api/payment/complete`, {
          sessionId: sessionData.sessionId,
          status: 'success',
          transactionId: imp_uid,
          amount: payment.amount,
          paymentMethod: payment.pay_method
        });

        paymentSessions.delete(merchant_uid);

        const returnUrl = `${sessionData.returnUrl}/coins?payment=success&coins=${sessionData.coins + (sessionData.bonusCoins || 0)}`;
        
        res.json({
          success: true,
          message: '결제가 완료되었습니다.',
          redirectUrl: returnUrl
        });
      } else {
        throw new Error('Payment not completed');
      }
    } else {
      await axios.post(`${MAIN_SERVICE_URL}/api/payment/complete`, {
        sessionId: sessionData.sessionId,
        status: 'failed',
        errorMessage: '결제가 취소되었습니다.'
      });

      paymentSessions.delete(merchant_uid);

      const returnUrl = `${sessionData.returnUrl}/coins?payment=failed`;
      
      res.json({
        success: false,
        message: '결제가 취소되었습니다.',
        redirectUrl: returnUrl
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    
    const sessionData = paymentSessions.get(req.body.merchant_uid);
    if (sessionData) {
      await axios.post(`${MAIN_SERVICE_URL}/api/payment/complete`, {
        sessionId: sessionData.sessionId,
        status: 'failed',
        errorMessage: error.message
      });
      
      paymentSessions.delete(req.body.merchant_uid);
    }

    res.status(500).json({
      success: false,
      message: '결제 처리 중 오류가 발생했습니다.',
      redirectUrl: `${MAIN_SERVICE_URL}/coins?payment=error`
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

setInterval(() => {
  const now = new Date();
  for (const [key, session] of paymentSessions.entries()) {
    if (now - session.createdAt > 3600000) {
      paymentSessions.delete(key);
    }
  }
}, 3600000);

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});

module.exports = app;
