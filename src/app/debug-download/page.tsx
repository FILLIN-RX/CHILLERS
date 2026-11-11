"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/api-base";
import { getBackendOrigin } from "@/services/http";
import { toIOSDownloadHref } from "@/services/downloads";
import { isIOS } from "@/services/streamSaver";

export default function DebugDownloadPage() {
  const [info, setInfo] = useState<any>(null);

  const diagnose = () => {
    const testUrl = "https://example.com/video.mp4";
    const filename = "test.mp4";
    
    const backendOrigin = getBackendOrigin();
    const relative = toIOSDownloadHref(testUrl, filename);
    const href = relative.startsWith("http") ? relative : `${backendOrigin}${relative}`;

    setInfo({
      isIOS: isIOS(),
      apiBaseUrl: API_BASE_URL,
      backendOrigin,
      testUrl,
      relativeHref: relative,
      finalHref: href,
      windowLocation: typeof window !== "undefined" ? window.location.href : "N/A",
      nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL || "NOT SET",
      nodeEnv: process.env.NODE_ENV,
    });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", background: "#000", color: "#0f0", minHeight: "100vh" }}>
      <h1 style={{ color: "#ff0" }}>🔍 CHILLERS Download Diagnostic</h1>
      
      <button 
        onClick={diagnose}
        style={{ 
          padding: "15px 30px", 
          fontSize: "18px", 
          background: "#0f0", 
          color: "#000",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        RUN DIAGNOSTIC
      </button>

      {info && (
        <div style={{ marginTop: "30px", lineHeight: "1.8" }}>
          <h2 style={{ color: "#ff0" }}>📊 Results:</h2>
          
          <div style={{ background: "#111", padding: "20px", borderRadius: "10px", marginTop: "10px" }}>
            <p><strong style={{ color: "#0ff" }}>Platform:</strong> {info.isIOS ? "iOS ✅" : "NOT iOS ❌"}</p>
            <p><strong style={{ color: "#0ff" }}>Current Location:</strong> {info.windowLocation}</p>
            <p><strong style={{ color: "#0ff" }}>NODE_ENV:</strong> {info.nodeEnv}</p>
            <hr style={{ borderColor: "#333", margin: "15px 0" }} />
            
            <p><strong style={{ color: "#f0f" }}>NEXT_PUBLIC_API_URL (env):</strong></p>
            <code style={{ color: "#ff0", background: "#222", padding: "5px 10px", display: "block", marginTop: "5px" }}>
              {info.nextPublicApiUrl}
            </code>
            
            <p style={{ marginTop: "15px" }}><strong style={{ color: "#f0f" }}>API_BASE_URL (computed):</strong></p>
            <code style={{ color: "#ff0", background: "#222", padding: "5px 10px", display: "block", marginTop: "5px" }}>
              {info.apiBaseUrl}
            </code>
            
            <p style={{ marginTop: "15px" }}><strong style={{ color: "#f0f" }}>Backend Origin:</strong></p>
            <code style={{ color: "#ff0", background: "#222", padding: "5px 10px", display: "block", marginTop: "5px" }}>
              {info.backendOrigin}
            </code>
            
            <hr style={{ borderColor: "#333", margin: "15px 0" }} />
            
            <p><strong style={{ color: "#0ff" }}>Test URL:</strong> {info.testUrl}</p>
            <p style={{ marginTop: "10px" }}><strong style={{ color: "#0ff" }}>Relative Href:</strong></p>
            <code style={{ color: "#0f0", background: "#222", padding: "5px 10px", display: "block", marginTop: "5px" }}>
              {info.relativeHref}
            </code>
            
            <p style={{ marginTop: "15px" }}><strong style={{ color: "#0ff" }}>Final Download URL:</strong></p>
            <code style={{ color: info.finalHref.includes("railway.app") ? "#0f0" : "#f00", background: "#222", padding: "5px 10px", display: "block", marginTop: "5px", fontWeight: "bold" }}>
              {info.finalHref}
            </code>
            
            {!info.finalHref.includes("railway.app") && (
              <p style={{ color: "#f00", marginTop: "10px", fontWeight: "bold" }}>
                ⚠️ WARNING: URL does NOT point to Railway backend!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
