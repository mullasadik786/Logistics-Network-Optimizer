/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Zap, Send, RefreshCw, Layers, CheckCircle2, AlertTriangle, Truck } from 'lucide-react';
import { GeminiRecommendation, Depot, RouteDisruption } from '../types';

interface CopilotPanelProps {
  metrics: {
    totalShipments: number;
    routedShipments: number;
    activeDisruptions: number;
    delayedCount: number;
    avgDelayMinutes: number;
  };
  disruptions: RouteDisruption[];
  depots: Depot[];
  onApplyDepotAdjustments: (adjustments: GeminiRecommendation['depotAdjustments']) => void;
  activeTab: 'chat' | 'orchestrator';
  setActiveTab: (tab: 'chat' | 'orchestrator') => void;
}

export default function CopilotPanel({
  metrics,
  disruptions,
  depots,
  onApplyDepotAdjustments,
  activeTab,
  setActiveTab,
}: CopilotPanelProps) {
  // Chat States
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: 'Hello, I am **Optima-AI**, your GPU-accelerated logistics co-pilot. I am monitoring the active SF Bay fulfillment network. Ask me anything about current delivery risks, BigQuery telemetry query results, or how to implement NVIDIA RAPIDS acceleration.',
    },
  ]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Orchestrator States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<GeminiRecommendation | null>({
    summary: "The spatial hazard clusters in the SOMA and Mission districts have inflated average delivery delays to 24.5 minutes. High-dwell bottlenecks are locking active cargo. Immediate reallocation of fleet reserves from Peninsula is recommended to balance East Bay's transshipment load.",
    actions: [
      {
        title: "Bypass SOMA Core congestion corridors",
        description: "Re-route all Peninsula-bound high-weight delivery trucks to the western Highway 280 corridor instead of Highway 101, avoiding the critical construction zones.",
        impact: "Reduces expected ETA delay by 18 minutes per dispatch.",
        priority: "CRITICAL"
      },
      {
        title: "Activate East Bay secondary sorting docks",
        description: "Due to high volume loading delays, redirect local package sorting to Oakland backup sorting docks to relieve load stress on the central hub.",
        impact: "Saves up to 14 minutes of vehicle stop dwell times.",
        priority: "HIGH"
      }
    ],
    depotAdjustments: [
      { depotId: "depot-0", reallocatedTrucks: -3, reason: "Downtown hub is choked by SOMA traffic. Shift active units to safer quadrants." },
      { depotId: "depot-2", reallocatedTrucks: 5, reason: "Deploy reserve flatbeds to South Bay to handle delayed high-weight shipments." },
      { depotId: "depot-3", reallocatedTrucks: -2, reason: "Peninsula has excess fleet capability based on low local delay scoring." }
    ]
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Call server-side /api/gemini/chat
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsSendingChat(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: chatHistory,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setChatHistory((prev) => [...prev, { role: 'assistant', content: data.text }]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ **Service Unavailable**: ${data.error || 'Failed to communicate with agent.'}` },
        ]);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ **Network Error**: Failed to dispatch request. Details: ${err.message}` },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Call server-side /api/gemini/analyze
  const triggerMitigationAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics,
          disruptions,
          depots: depots.map((d) => ({
            id: d.id,
            name: d.name,
            trucks: d.activeTrucks,
            capacity: d.capacity,
            loadPercent: Math.round((d.activeTrucks / d.capacity) * 100),
          })),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRecommendation(data);
      } else {
        console.error('Gemini mitigation failed:', data.error);
      }
    } catch (err) {
      console.error('Failed to analyze mitigation:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 border border-zinc-800 rounded overflow-hidden" id="copilot-sidebar-container">
      {/* Sidebar Header & Tabs */}
      <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="text-orange-500 animate-pulse" size={18} />
            <h2 className="text-sm font-black text-zinc-100 tracking-wider uppercase font-mono">OPTIMA-AI CO-PILOT</h2>
          </div>
          <span className="text-[9px] font-mono bg-zinc-900 text-orange-500 border border-zinc-800 px-1.5 py-0.5 rounded uppercase font-bold">
            AGENT ONLINE
          </span>
        </div>

        {/* Tabs switcher */}
        <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded border border-zinc-800 text-xs">
          <button
            onClick={() => setActiveTab('orchestrator')}
            className={`py-1.5 rounded font-black uppercase tracking-wider transition-all ${
              activeTab === 'orchestrator'
                ? 'bg-zinc-950 text-orange-500 border border-zinc-850 shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Orchestrator
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-1.5 rounded font-black uppercase tracking-wider transition-all ${
              activeTab === 'chat'
                ? 'bg-zinc-950 text-orange-500 border border-zinc-850 shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Consult Co-pilot
          </button>
        </div>
      </div>

      {/* Panel Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'orchestrator' ? (
          /* ORCHESTRATOR SUB-PANEL */
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-zinc-950 p-3 rounded border border-zinc-800">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Risk Strategy Compiler</span>
                <span className="text-[11px] font-medium text-zinc-300">Run structured network diagnostic</span>
              </div>
              <button
                onClick={triggerMitigationAnalysis}
                disabled={isAnalyzing}
                className={`p-2 rounded bg-orange-500 hover:bg-orange-400 text-black transition-all ${
                  isAnalyzing ? 'animate-spin cursor-not-allowed bg-zinc-800 text-zinc-600' : 'cursor-pointer'
                }`}
                title="Refresh recommendation playbooks"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {isAnalyzing ? (
              <div className="bg-zinc-950/40 border border-zinc-800 rounded p-8 text-center space-y-3">
                <RefreshCw size={24} className="text-orange-500 animate-spin mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs font-black text-zinc-300 tracking-wider uppercase">GEMINI GENERATIVE THREAD OPENED</p>
                  <p className="text-[10px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                    Analyzing active geographical congestion clusters, evaluating fleet capacity balances, and structuring reallocation solutions...
                  </p>
                </div>
              </div>
            ) : recommendation ? (
              <div className="space-y-4">
                {/* Executive Summary */}
                <div className="bg-zinc-950/70 border-l-2 border-orange-500 p-3.5 rounded-r space-y-1.5">
                  <span className="text-[10px] font-mono text-orange-500 font-black uppercase tracking-widest flex items-center gap-1">
                    <Layers size={10} /> EXECUTIVE RECOMMENDATION
                  </span>
                  <p className="text-[11px] text-zinc-300 leading-relaxed font-sans font-medium">
                    {recommendation.summary}
                  </p>
                </div>

                {/* Priority Actions */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Critical Safety Measures</span>
                  {recommendation.actions.map((act, i) => (
                    <div key={i} className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-1.5 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-black tracking-tight text-zinc-200 leading-tight max-w-[180px]">{act.title}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          act.priority === 'CRITICAL' 
                            ? 'bg-red-950/50 text-red-400 border border-red-900/60 animate-pulse'
                            : act.priority === 'HIGH'
                            ? 'bg-orange-950/50 text-orange-400 border border-orange-900/60'
                            : 'bg-yellow-950/50 text-yellow-400 border border-yellow-900/60'
                        }`}>
                          {act.priority}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">{act.description}</p>
                      <div className="text-[10px] text-orange-500 font-mono font-bold pt-1 border-t border-zinc-900 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Impact: {act.impact}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Depot Adjustments & Active Trigger */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Depot Fleet Adjustments</span>
                  <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-3">
                    <div className="space-y-2">
                      {recommendation.depotAdjustments.map((adj, i) => {
                        const isPositive = adj.reallocatedTrucks >= 0;
                        return (
                          <div key={i} className="flex justify-between items-start text-[10px] font-mono border-b border-zinc-900 pb-2 last:border-0 last:pb-0">
                            <div className="space-y-0.5">
                              <span className="font-bold text-zinc-300 block uppercase">{adj.depotId.replace('-', ' ')}</span>
                              <p className="text-[9px] text-zinc-500 font-sans leading-tight pr-4">{adj.reason}</p>
                            </div>
                            <span className={`font-bold shrink-0 px-1.5 py-0.5 rounded text-xs ${
                              isPositive 
                                ? 'bg-zinc-900 text-orange-400 border border-zinc-800' 
                                : 'bg-red-950 text-red-400 border border-red-900'
                            }`}>
                              {isPositive ? '+' : ''}{adj.reallocatedTrucks} Trucks
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => onApplyDepotAdjustments(recommendation.depotAdjustments)}
                      className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-black text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-orange-500/10 uppercase tracking-wider"
                    >
                      <Truck size={12} />
                      APPLY DEPLOYMENT ADJUSTMENTS
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-500 py-12">
                <AlertTriangle className="mx-auto mb-2 text-zinc-700" size={24} />
                <p className="text-xs font-mono">No recommendation cached.</p>
                <button
                  onClick={triggerMitigationAnalysis}
                  className="mt-2 text-xs text-orange-400 font-bold hover:underline"
                >
                  Query AI Mitigation Now
                </button>
              </div>
            )}
          </div>
        ) : (
          /* CONVERSATIONAL CHAT SUB-PANEL */
          <div className="flex flex-col h-[480px]">
            {/* Scrollable conversation history */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded text-xs leading-relaxed max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-zinc-900 border border-zinc-850 text-orange-400 ml-auto'
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-300 mr-auto'
                  }`}
                >
                  {/* Basic markdown parsing for bolding */}
                  {msg.content.split('**').map((part, index) => 
                    index % 2 === 1 ? <strong key={index} className="text-orange-500 font-bold">{part}</strong> : part
                  )}
                </div>
              ))}
              {isSendingChat && (
                <div className="p-2.5 rounded text-xs bg-zinc-950 border border-zinc-800 text-zinc-500 mr-auto flex items-center gap-2 max-w-[80%] animate-pulse">
                  <RefreshCw size={10} className="animate-spin text-orange-500" />
                  <span className="font-bold tracking-wider uppercase text-[10px]">OPTIMA THREAD PROCESSING...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form footer */}
            <form onSubmit={handleSendChat} className="flex gap-2 bg-zinc-950 border border-zinc-800 p-1.5 rounded">
              <input
                type="text"
                placeholder="Ask about routing bottlenecks..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isSendingChat}
                className="flex-1 bg-transparent px-2.5 py-1 text-xs text-zinc-200 outline-none placeholder-zinc-700 disabled:text-zinc-500"
              />
              <button
                type="submit"
                disabled={isSendingChat || !chatInput.trim()}
                className={`p-2 rounded bg-orange-500 text-black hover:bg-orange-400 transition-all ${
                  isSendingChat || !chatInput.trim() ? 'opacity-40 cursor-not-allowed bg-zinc-800 text-zinc-500' : 'cursor-pointer'
                }`}
              >
                <Send size={12} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
