import React from 'react';
import { Shield, Lock, Cpu, Database, FileCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { hapticFeedback } from '../core/utils/haptics';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const handleBack = () => {
    hapticFeedback.light();
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white p-6 md:p-12 pt-safe pb-24 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute -top-40 left-1/4 w-96 h-96 bg-[#7C5CFC]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-[#4F8EF7]/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/5 cursor-pointer text-xs font-semibold"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>

        {/* Header */}
        <header className="mb-10 text-left">
          <span className="text-[10px] text-[#7C5CFC] font-extrabold uppercase tracking-[0.25em] flex items-center gap-1.5 bg-[#7C5CFC]/10 border border-[#7C5CFC]/20 px-3 py-1 rounded-full w-fit mb-3">
            <Shield size={10} />
            Security & Trust
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-gray-400 text-xs md:text-sm">
            Last Updated: May 2026. Designed strictly in compliance with DPDPA 2023.
          </p>
        </header>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Card 1: Local First & IndexedDB */}
          <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#4F8EF7]/10 border border-[#4F8EF7]/20 flex items-center justify-center text-[#4F8EF7] shrink-0">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">1. Local-First Storage Architecture</h3>
                <p className="text-gray-400 text-xs md:text-sm leading-relaxed">
                  Smart Spend AI is built with an offline-first philosophy. Your transactions, accounts, merchant mappings, anomalies, and financial goals are stored directly on your physical device using **IndexedDB (via Dexie.js)**. 
                </p>
                <p className="text-gray-400 text-xs md:text-sm leading-relaxed mt-2">
                  This database remains strictly local and private. Free-tier users' financial tracking data never leaves their local device.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: AI Privacy & Proxy */}
          <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#7C5CFC]/10 border border-[#7C5CFC]/20 flex items-center justify-center text-[#7C5CFC] shrink-0">
                <Cpu size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">2. Gemini AI Processing & Privacy Policy</h3>
                <p className="text-gray-400 text-xs md:text-sm leading-relaxed">
                  When you explicitly use our advanced AI capabilities (such as PDF statement ingestion, receipt OCR scanning, and spending anomaly generation), specific inputs are securely proxied through our secure backend to the **Gemini AI API**.
                </p>
                <ul className="list-disc list-inside text-gray-400 text-xs md:text-sm mt-3 space-y-1.5">
                  <li>AI keys are locked strictly server-side inside our Vercel environments.</li>
                  <li>No raw API keys are ever stored on or transmitted to the client.</li>
                  <li>Gemini inputs are transient and used only to extract transaction structures.</li>
                  <li>We strictly enforce **zero data retention** for training models on your transactions.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Card 3: Cloud Syncing & Authentication */}
          <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#4F8EF7]/10 border border-[#4F8EF7]/20 flex items-center justify-center text-[#4F8EF7] shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">3. Cloud Syncing & PRO Tier Gating</h3>
                <p className="text-gray-400 text-xs md:text-sm leading-relaxed">
                  Smart Spend PRO accounts sync transactional data with secure Firebase Firestore databases. 
                </p>
                <ul className="list-disc list-inside text-gray-400 text-xs md:text-sm mt-3 space-y-1.5">
                  <li>Authentication is managed securely by Firebase Auth.</li>
                  <li>Firestore isolation rules prevent direct writes from unauthorized accounts.</li>
                  <li>Payment processing is managed securely by Razorpay. We do not store credit card or bank details on our servers.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Card 4: DPDPA 2023 Compliance */}
          <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-[#10B981] shrink-0">
                <FileCheck size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">4. Indian DPDPA 2023 Compliance</h3>
                <p className="text-gray-400 text-xs md:text-sm leading-relaxed">
                  As an Indian-focused expense tracker, we fully comply with the **Digital Personal Data Protection (DPDP) Act of 2023**.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold text-white block mb-1">Right to Access & Portability</span>
                    <span className="text-[11px] text-gray-400">Export your local and synced data anytime as a standardized JSON structure.</span>
                  </div>
                  <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold text-white block mb-1">Right to Correction & Erasure</span>
                    <span className="text-[11px] text-gray-400">Instantly delete all local IndexedDB data and cloud Firestore archives with a single click.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Consent Statement */}
        <div className="mt-12 text-center border-t border-white/5 pt-8">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
            By using Smart Spend AI, you explicitly consent to local storage sandbox guidelines and transient proxy parsing limits.
          </p>
        </div>
      </div>
    </div>
  );
}
