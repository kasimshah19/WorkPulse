'use client';

import React, { useState } from 'react';
import api from '../../lib/api';
import { formatRupees, parseRupeesToPaise } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { X, CheckCircle2, ShieldCheck, Zap, AlertCircle, RefreshCw } from 'lucide-react';

const PRESETS = [500, 1000, 2000, 5000];

export function TopupModal({ isOpen, onClose, onSuccess, currentBalancePaise = 0 }) {
  const [amountRupees, setAmountRupees] = useState('1000');
  const [providerMode, setProviderMode] = useState('mock'); // 'mock' | 'razorpay'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  if (!isOpen) return null;

  const parsedPaise = parseRupeesToPaise(amountRupees || '0');

  const handleTopup = async () => {
    setError('');
    setIsLoading(true);
    setSuccessInfo(null);

    try {
      const rupeesNum = parseFloat(amountRupees);
      if (isNaN(rupeesNum) || rupeesNum <= 0) {
        throw new Error('कृपया सही राशि दर्ज करें (Please enter a valid amount).');
      }

      // Step 1: Create top-up order
      const createRes = await api.post('/payments/topup-order', {
        amountRupees: rupeesNum,
      });

      const orderData = createRes.data;
      const { paymentOrderId, gatewayOrderId, keyId, amountPaise } = orderData;

      if (providerMode === 'mock' || orderData.provider === 'mock') {
        // Mock instant completion
        const verifyRes = await api.post('/payments/mock-complete', { paymentOrderId });
        const newBalance = verifyRes.data?.balancePaise;
        setSuccessInfo({
          amountPaise,
          newBalancePaise: newBalance,
          method: 'Mock Instant Top-Up',
        });
        if (onSuccess) onSuccess(newBalance);
      } else {
        // Razorpay checkout flow
        await handleRazorpayFlow({ orderData, paymentOrderId });
      }
    } catch (err) {
      setError(err.message || 'टॉप-अप विफल रहा (Top-up failed).');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRazorpayFlow = ({ orderData, paymentOrderId }) => {
    return new Promise((resolve, reject) => {
      // Check if window.Razorpay is loaded, else inject dynamically
      const loadRazorpayScript = () => {
        return new Promise((res) => {
          if (window.Razorpay) return res(true);
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => res(true);
          script.onerror = () => res(false);
          document.body.appendChild(script);
        });
      };

      loadRazorpayScript().then((loaded) => {
        if (!loaded || !window.Razorpay) {
          // Graceful fallback to mock payment
          setError('Razorpay checkout लोड नहीं हो सका। कृपया Mock Mode का उपयोग करें।');
          reject(new Error('Razorpay SDK failed to load.'));
          return;
        }

        const options = {
          key: orderData.keyId || 'rzp_test_placeholder',
          amount: orderData.amountPaise,
          currency: 'INR',
          name: 'WorkPulse',
          description: 'Contractor Wallet Top-Up',
          order_id: orderData.gatewayOrderId,
          handler: async (response) => {
            try {
              setIsLoading(true);
              const verifyRes = await api.post('/payments/verify', {
                paymentOrderId,
                gatewayPaymentId: response.razorpay_payment_id,
                gatewaySignature: response.razorpay_signature,
              });

              const newBalance = verifyRes.data?.balancePaise;
              setSuccessInfo({
                amountPaise: orderData.amountPaise,
                newBalancePaise: newBalance,
                method: 'Razorpay',
              });
              if (onSuccess) onSuccess(newBalance);
              resolve(verifyRes);
            } catch (vErr) {
              setError(vErr.message || 'भुगतान सत्यापन विफल रहा');
              reject(vErr);
            } finally {
              setIsLoading(false);
            }
          },
          prefill: {
            name: 'Contractor',
            contact: '+919000000100',
          },
          theme: {
            color: '#2563eb',
          },
          modal: {
            ondismiss: () => {
              setIsLoading(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp) => {
          setError(resp.error?.description || 'Payment Failed');
          setIsLoading(false);
        });
        rzp.open();
      });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">वॉलेट टॉप-अप (Top-Up Wallet)</h2>
              <p className="text-xs text-slate-400">
                उपलब्ध शेष: <span className="font-semibold text-slate-200">{formatRupees(currentBalancePaise)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successInfo ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">टॉप-अप सफल रहा!</h3>
              <p className="text-sm text-slate-300 mt-1">
                {formatRupees(successInfo.amountPaise)} आपके बटुए में जोड़ दिए गए हैं।
              </p>
              <p className="text-xs text-slate-400 mt-1">
                नया बैलेंस: <span className="text-emerald-400 font-semibold">{formatRupees(successInfo.newBalancePaise)}</span>
              </p>
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                setSuccessInfo(null);
                onClose();
              }}
            >
              पूर्ण (Done)
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quick Presets */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 block">
                त्वरित राशि चुनें (Select Preset)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((p) => {
                  const isSelected = String(p) === amountRupees;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmountRupees(String(p))}
                      className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm shadow-blue-500/20'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      ₹{p.toLocaleString('en-IN')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                या कस्टम राशि दर्ज करें (Rupees)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  placeholder="1000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-white font-semibold text-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                लेज़र में सुरक्षित: <span className="font-mono text-slate-300">{parsedPaise.toLocaleString('en-IN')} paise</span>
              </p>
            </div>

            {/* Driver Mode Selection */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                भुगतान माध्यम (Payment Driver)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProviderMode('mock')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    providerMode === 'mock'
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Zap className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Mock Top-Up</div>
                    <div className="text-[10px] text-slate-400">तुरंत सिमुलेटेड टेस्ट</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProviderMode('razorpay')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    providerMode === 'razorpay'
                      ? 'bg-blue-950/40 border-blue-500/60 text-blue-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Razorpay Test</div>
                    <div className="text-[10px] text-slate-400">चेकआउट विंडो</div>
                  </div>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full flex items-center justify-center gap-2 py-3"
              disabled={isLoading || parsedPaise <= 0}
              onClick={handleTopup}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  भुगतान संसाधित हो रहा है...
                </>
              ) : (
                `टॉप-अप करें ${formatRupees(parsedPaise)}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
