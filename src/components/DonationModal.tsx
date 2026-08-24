"use client";

import React, { useState, useEffect } from "react";
import { Modal, ConfigProvider, theme, message } from "antd";
import {
  IconHeart,
  IconCopy,
  IconCheck,
  IconSparkles,
  IconDeviceMobile,
  IconCreditCard,
} from "@tabler/icons-react";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const copyToClipboard = async (text: string, type: "om" | "momo", label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedType(type);
      messageApi.open({
        type: "success",
        content: `Numéro ${label} (${text}) copié dans le presse-papiers !`,
        duration: 3,
      });
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#D70466",
          colorBgElevated: "#18181B",
          colorBorder: "rgba(255, 255, 255, 0.12)",
          borderRadiusLG: 24,
          fontFamily: "var(--font-sans), Arial, sans-serif",
        },
      }}
    >
      {contextHolder}
      <Modal
        open={isOpen}
        onCancel={onClose}
        footer={null}
        centered
        width={460}
        styles={{
          mask: {
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
          },
          content: {
            background: "linear-gradient(180deg, #20131A 0%, #18181B 35%, #121214 100%)",
            border: "1px solid rgba(215, 4, 102, 0.25)",
            boxShadow: "0 25px 50px -12px rgba(215, 4, 102, 0.25), 0 0 40px rgba(0, 0, 0, 0.9)",
            borderRadius: "28px",
            padding: "28px 24px",
            position: "relative",
            overflow: "hidden",
          },
        }}
      >
        {/* Glow ambient background in Chillers palette */}
        <div className="absolute -top-12 -left-12 w-44 h-44 bg-[#D70466]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-44 h-44 bg-[#7C3AED]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative z-10 text-center space-y-3 pt-1">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#D70466] via-[#E11D48] to-[#7C3AED] flex items-center justify-center text-white shadow-xl shadow-[#D70466]/30 mx-auto transform hover:scale-105 transition-transform">
              <IconHeart className="h-8 w-8 fill-white animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-zinc-900 rounded-full border border-white/10">
              <IconSparkles className="h-4 w-4 text-amber-400" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-black tracking-tight text-white">
              Soutenez <span className="text-[#D70466]">CHILLERS</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed max-w-sm mx-auto">
              Chillers est 100% gratuit, sans abonnement ni publicité intrusive. Votre don permet de payer les serveurs et la bande passante haute vitesse !
            </p>
          </div>
        </div>

        {/* Donation Cards */}
        <div className="relative z-10 mt-6 space-y-3.5">
          {/* Orange Money Card */}
          <div className="group relative p-4 rounded-2xl bg-zinc-900/80 border border-orange-500/30 hover:border-orange-500/70 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/15">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center font-black text-orange-400 text-sm shadow-inner">
                  OM
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-orange-400 uppercase tracking-wider">
                      Orange Money
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                      Cameroun
                    </span>
                  </div>
                  <span className="text-base sm:text-lg font-black text-white font-mono tracking-wider block mt-0.5">
                    697 40 73 80
                  </span>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard("697407380", "om", "Orange Money")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  copiedType === "om"
                    ? "bg-green-500/20 border border-green-500/50 text-green-400"
                    : "bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500/40 text-orange-200 hover:text-white"
                }`}
              >
                {copiedType === "om" ? (
                  <>
                    <IconCheck className="h-4 w-4" />
                    Copié !
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <IconDeviceMobile className="h-3.5 w-3.5 text-orange-400" />
                Code direct :
              </span>
              <span className="font-mono text-xs text-orange-300 font-bold bg-black/40 px-2 py-0.5 rounded border border-orange-500/20">
                #150*1*1*697407380*MONTANT#
              </span>
            </div>
          </div>

          {/* MTN Mobile Money Card */}
          <div className="group relative p-4 rounded-2xl bg-zinc-900/80 border border-yellow-500/30 hover:border-yellow-500/70 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/15">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center font-black text-yellow-400 text-sm shadow-inner">
                  MoMo
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-yellow-400 uppercase tracking-wider">
                      MTN Mobile Money
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                      Cameroun
                    </span>
                  </div>
                  <span className="text-base sm:text-lg font-black text-white font-mono tracking-wider block mt-0.5">
                    674 37 64 24
                  </span>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard("674376424", "momo", "MTN MoMo")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  copiedType === "momo"
                    ? "bg-green-500/20 border border-green-500/50 text-green-400"
                    : "bg-yellow-500/20 hover:bg-yellow-500/35 border border-yellow-500/40 text-yellow-200 hover:text-white"
                }`}
              >
                {copiedType === "momo" ? (
                  <>
                    <IconCheck className="h-4 w-4" />
                    Copié !
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <IconDeviceMobile className="h-3.5 w-3.5 text-yellow-400" />
                Code direct :
              </span>
              <span className="font-mono text-xs text-yellow-300 font-bold bg-black/40 px-2 py-0.5 rounded border border-yellow-500/20">
                *126*1*1*674376424*MONTANT#
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="relative z-10 mt-6 pt-4 border-t border-white/5 text-center space-y-3">
          <p className="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
            <span className="text-emerald-400 font-bold">✓</span>
            Chaque geste, même 500 FCFA, aide énormément la communauté !
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D70466] to-[#7C3AED] hover:from-[#E11D48] hover:to-[#8B5CF6] text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-[#D70466]/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            Continuer sur Chillers
          </button>
        </div>
      </Modal>
    </ConfigProvider>
  );
}
