/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shipment, Depot, RouteDisruption, GeminiRecommendation } from './types';
import NetworkMap from './components/NetworkMap';
import BenchmarkPanel from './components/BenchmarkPanel';
import BigQueryExplorer from './components/BigQueryExplorer';
import CopilotPanel from './components/CopilotPanel';
import { 
  Compass, 
  Cpu, 
  Database, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  Sliders, 
  TrendingUp,
  Activity,
  Layers,
  Truck
} from 'lucide-react';

// Initial Depots centered around key SF Bay nodes
const initialDepots: Depot[] = [
  { id: 'depot-0', name: 'SF Downtown (HQ)', lat: 37.7749, lng: -122.4194, capacity: 45, activeTrucks: 38, zoneColor: '#ef4444', radiusKm: 12 }, // Red
  { id: 'depot-1', name: 'Oakland Hub', lat: 37.8044, lng: -122.2711, capacity: 55, activeTrucks: 48, zoneColor: '#10b981', radiusKm: 15 }, // Green
  { id: 'depot-2', name: 'San Jose Depot', lat: 37.3382, lng: -121.8863, capacity: 60, activeTrucks: 42, zoneColor: '#3b82f6', radiusKm: 20 }, // Blue
  { id: 'depot-3', name: 'Peninsula Logistics', lat: 37.5630, lng: -122.3255, capacity: 40, activeTrucks: 30, zoneColor: '#a855f7', radiusKm: 14 }, // Purple
];

// Seed initial disruptions
const initialDisruptions: RouteDisruption[] = [
  {
    id: 'dis-1',
    lat: 37.7610,
    lng: -122.4120,
    radius: 0.045, // Map degrees
    type: 'Traffic Congestion',
    severity: 'Major',
    description: 'Critical cargo congestion corridor near Mission District exit.',
  }
];

function generateInitialShipments(depots: Depot[]): Shipment[] {
  const shipments: Shipment[] = [];
  const priorities: Shipment['priority'][] = ['High', 'Medium', 'Low'];
  
  for (let i = 0; i < 1800; i++) {
    const clusterId = i % depots.length;
    const depot = depots[clusterId];
    
    // Disperse points around depot center
    const r = Math.random() * 0.14; // degree radius disperse
    const theta = Math.random() * Math.PI * 2;
    const lat = depot.lat + r * Math.sin(theta);
    const lng = depot.lng + r * Math.cos(theta);
    
    const id = `ship-${10200 + i}`;
    const weight = Math.round(5 + Math.random() * 345); // in lbs
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const street = ['Market St', 'Mission St', 'Shattuck Ave', 'Grand Ave', 'El Camino Real', 'University Ave', '1st St'][Math.floor(Math.random() * 7)];
    const address = `${Math.floor(100 + Math.random() * 3200)} ${street}, SF Bay Area`;
    
    shipments.push({
      id,
      lat,
      lng,
      status: 'Routed',
      priority,
      weight,
      clusterId,
      address,
      riskScore: Math.round(5 + (weight % 25)), // base risk
      etaMinutes: Math.round(12 + Math.random() * 78),
      dwellTimeMinutes: Math.round(5 + Math.random() * 12)
    });
  }
  return shipments;
}

function updateShipmentRisks(shipments: Shipment[], disruptions: RouteDisruption[]): Shipment[] {
  return shipments.map((ship) => {
    let affected = false;
    let riskMultiplier = 1;
    
    disruptions.forEach((dis) => {
      const dist = Math.sqrt(Math.pow(ship.lat - dis.lat, 2) + Math.pow(ship.lng - dis.lng, 2));
      if (dist < dis.radius) {
        affected = true;
        if (dis.severity === 'Critical') {
          riskMultiplier = Math.max(riskMultiplier, 3.2);
        } else if (dis.severity === 'Major') {
          riskMultiplier = Math.max(riskMultiplier, 2.0);
        } else {
          riskMultiplier = Math.max(riskMultiplier, 1.3);
        }
      }
    });
    
    if (affected) {
      const newRisk = Math.min(99, Math.round((10 + (ship.weight % 25)) * riskMultiplier));
      const newEta = Math.round((12 + (ship.weight % 78)) * (1 + (riskMultiplier - 1) * 0.7));
      return {
        ...ship,
        status: 'Disrupted',
        riskScore: newRisk,
        etaMinutes: newEta,
        dwellTimeMinutes: Math.round(ship.dwellTimeMinutes * riskMultiplier)
      };
    } else {
      return {
        ...ship,
        status: 'Routed',
        riskScore: Math.round(10 + (ship.weight % 25)),
        etaMinutes: Math.round(12 + (ship.weight % 78))
      };
    }
  });
}

export default function App() {
  const [activePanel, setActivePanel] = useState<'oversight' | 'benchmark' | 'bigquery'>('oversight');
  const [copilotTab, setCopilotTab] = useState<'orchestrator' | 'chat'>('orchestrator');

  // Master Network States
  const [depots, setDepots] = useState<Depot[]>(initialDepots);
  const [disruptions, setDisruptions] = useState<RouteDisruption[]>(initialDisruptions);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Selection states
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'clusters' | 'risk' | 'routes'>('clusters');

  // Generate shipments on load and apply initial risks
  useEffect(() => {
    const rawShipments = generateInitialShipments(initialDepots);
    const updated = updateShipmentRisks(rawShipments, initialDisruptions);
    setShipments(updated);
  }, []);

  // Recalculate risks when disruptions are injected
  const handleAddDisruption = (newDisruption: RouteDisruption) => {
    const newDisruptions = [...disruptions, newDisruption];
    setDisruptions(newDisruptions);
    
    const updatedShipments = updateShipmentRisks(shipments, newDisruptions);
    setShipments(updatedShipments);

    // If currently selected shipment was affected, update its detail too
    if (selectedShipment) {
      const match = updatedShipments.find(s => s.id === selectedShipment.id);
      if (match) setSelectedShipment(match);
    }
  };

  const handleApplyDepotAdjustments = (adjustments: GeminiRecommendation['depotAdjustments']) => {
    setDepots(prevDepots => {
      return prevDepots.map(depot => {
        const adjustment = adjustments.find(adj => adj.depotId.toLowerCase() === depot.id.toLowerCase());
        if (adjustment) {
          const newActiveTrucks = Math.max(0, Math.min(depot.capacity, depot.activeTrucks + adjustment.reallocatedTrucks));
          return {
            ...depot,
            activeTrucks: newActiveTrucks
          };
        }
        return depot;
      });
    });
    alert("Enterprise Fleet Reallocation Successful! Depot active vehicle states updated on Map Command layer.");
  };

  const triggerAnimationSolver = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setIsOptimizing(false);
    }, 2500);
  };

  // Derived metrics for UI scoreboards
  const totalShipmentsCount = shipments.length;
  const delayedShipments = shipments.filter(s => s.status === 'Disrupted');
  const delayedCount = delayedShipments.length;
  const avgDelayMinutes = delayedCount > 0 
    ? Math.round(delayedShipments.reduce((acc, curr) => acc + curr.etaMinutes, 0) / delayedCount) 
    : 0;

  const currentMetrics = {
    totalShipments: totalShipmentsCount,
    routedShipments: totalShipmentsCount - delayedCount,
    activeDisruptions: disruptions.length,
    delayedCount: delayedCount,
    avgDelayMinutes: avgDelayMinutes
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans select-none overflow-hidden" id="app-root">
      
      {/* 1. TOP COMMAND HEADER */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex justify-between items-center z-10 shrink-0" id="header-bar">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Compass className="text-black stroke-[2.5]" size={20} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tighter leading-none uppercase italic text-zinc-100">
              VORTEX-L7
            </h1>
            <p className="text-[9px] tracking-[0.25em] font-bold text-zinc-500 uppercase mt-1">
              NVIDIA ACCELERATED LOGISTICS COMMAND
            </p>
          </div>
        </div>

        {/* Primary View Swapper Tabs */}
        <div className="flex bg-zinc-950 p-1 rounded border border-zinc-800 gap-1 text-xs font-mono">
          <button
            onClick={() => setActivePanel('oversight')}
            className={`px-4 py-1.5 rounded font-black tracking-wider transition-all uppercase flex items-center gap-1.5 ${
              activePanel === 'oversight'
                ? 'bg-zinc-900 text-orange-500 border border-zinc-700 shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Layers size={13} />
            Oversight Cockpit
          </button>
          <button
            onClick={() => setActivePanel('benchmark')}
            className={`px-4 py-1.5 rounded font-black tracking-wider transition-all uppercase flex items-center gap-1.5 ${
              activePanel === 'benchmark'
                ? 'bg-zinc-900 text-orange-500 border border-zinc-700 shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Cpu size={13} />
            GPU Benchmark Lab
          </button>
          <button
            onClick={() => setActivePanel('bigquery')}
            className={`px-4 py-1.5 rounded font-black tracking-wider transition-all uppercase flex items-center gap-1.5 ${
              activePanel === 'bigquery'
                ? 'bg-zinc-900 text-orange-500 border border-zinc-700 shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Database size={13} />
            BigQuery Warehouse
          </button>
        </div>

        {/* Real-time Status tickers */}
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500 border-l border-zinc-800 pl-4">
          <div className="flex items-center gap-2 px-3 py-1 border border-zinc-700 bg-zinc-900 rounded-full">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span className="font-bold tracking-wider uppercase text-zinc-300">LIVE PIPELINE</span>
          </div>
          <div className="px-3 py-1 border border-zinc-700 bg-zinc-900 rounded-full text-zinc-300">UTC: {new Date().toISOString().slice(11, 19)}</div>
        </div>
      </header>

      {/* 2. MAIN SUB-PANEL BODY LAYOUT */}
      <main className="flex-1 flex overflow-hidden min-h-0" id="main-content-layout">
        
        {/* Workspace panel switcher */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto min-w-0 min-h-0">
          
          {/* Active Work Panel */}
          <div className="flex-1 min-h-0">
            {activePanel === 'oversight' && (
              /* PANEL A: OVERSIGHT COMMAND COCKPIT */
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full" id="oversight-cockpit-view">
                
                {/* Scoreboards Metrics shelf & Spatial Map */}
                <div className="lg:col-span-3 flex flex-col h-full space-y-6">
                  
                  {/* Master metrics HUD */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" id="telemetry-hud-cards">
                    
                    {/* Active Cargo nodes */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4 flex flex-col justify-between group hover:border-zinc-700 transition-all">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">ACTIVE CARGO NODES</span>
                      <div className="my-1.5 flex items-baseline gap-1">
                        <span className="text-5xl font-black text-zinc-100 tracking-tighter leading-none group-hover:text-orange-500 transition-colors">
                          {totalShipmentsCount.toLocaleString()}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">units</span>
                      </div>
                      <div className="h-1 bg-zinc-800 mt-4 overflow-hidden rounded-full">
                        <div className="h-full bg-orange-500 w-[100%]"></div>
                      </div>
                      <div className="text-[9px] text-zinc-500 flex items-center gap-1.5 pt-2 mt-1 border-t border-zinc-800/50">
                        <Activity size={10} className="text-orange-500" />
                        <span>DIVERGENT SPATIAL CLUSTERS</span>
                      </div>
                    </div>

                    {/* Disruption count */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4 flex flex-col justify-between group hover:border-zinc-700 transition-all">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">SPATIAL HAZARDS</span>
                      <div className="my-1.5 flex items-baseline gap-1">
                        <span className="text-5xl font-black text-orange-500 tracking-tighter leading-none">
                          {disruptions.length}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">active</span>
                      </div>
                      <div className="h-1 bg-zinc-800 mt-4 overflow-hidden rounded-full">
                        <div className="h-full bg-orange-500 w-[40%]"></div>
                      </div>
                      <div className="text-[9px] text-zinc-500 flex items-center gap-1.5 pt-2 mt-1 border-t border-zinc-800/50">
                        <ShieldAlert size={10} className="text-orange-500" />
                        <span>LIVE SPATIAL INGESTION</span>
                      </div>
                    </div>

                    {/* Affected shipment list size */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4 flex flex-col justify-between group hover:border-zinc-700 transition-all">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">CHOKED SHIPMENTS</span>
                      <div className="my-1.5 flex items-baseline gap-1">
                        <span className="text-5xl font-black text-orange-500 tracking-tighter leading-none group-hover:text-orange-400 transition-colors">
                          {delayedCount}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">({Math.round(delayedCount / totalShipmentsCount * 100)}%)</span>
                      </div>
                      <div className="h-1 bg-zinc-800 mt-4 overflow-hidden rounded-full">
                        <div className="h-full bg-orange-500" style={{ width: `${Math.round(delayedCount / totalShipmentsCount * 100)}%` }}></div>
                      </div>
                      <div className="text-[9px] text-zinc-500 flex items-center gap-1.5 pt-2 mt-1 border-t border-zinc-800/50">
                        <Sliders size={10} className="text-orange-500" />
                        <span>INSIDE CONGESTION RADII</span>
                      </div>
                    </div>

                    {/* Fleet Delay Severity */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4 flex flex-col justify-between group hover:border-zinc-700 transition-all">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">DELAY ETA AVERAGE</span>
                      <div className="my-1.5 flex items-baseline gap-1">
                        <span className="text-5xl font-black text-zinc-100 tracking-tighter leading-none group-hover:text-orange-500 transition-colors">
                          {avgDelayMinutes}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">mins</span>
                      </div>
                      <div className="h-1 bg-zinc-800 mt-4 overflow-hidden rounded-full">
                        <div className="h-full bg-orange-500 w-[65%]"></div>
                      </div>
                      <div className="text-[9px] text-zinc-500 flex items-center gap-1.5 pt-2 mt-1 border-t border-zinc-800/50">
                        <Clock size={10} className="text-zinc-500" />
                        <span>CRITICAL THRESHOLD: 45M</span>
                      </div>
                    </div>

                  </div>

                  {/* High performance Canvas Spatial network map */}
                  <div className="flex-1 min-h-[360px] relative">
                    <NetworkMap
                      shipments={shipments}
                      depots={depots}
                      disruptions={disruptions}
                      selectedShipment={selectedShipment}
                      selectedDepot={selectedDepot}
                      onSelectShipment={setSelectedShipment}
                      onSelectDepot={setSelectedDepot}
                      onAddDisruption={handleAddDisruption}
                      isOptimizing={isOptimizing}
                      viewMode={mapViewMode}
                    />

                    {/* Map Mode selector controls */}
                    <div className="absolute top-3 right-3 z-10 flex bg-zinc-900 border border-zinc-800 p-1 rounded shadow-lg text-[10px] font-mono uppercase tracking-wider font-bold">
                      <button
                        onClick={() => setMapViewMode('clusters')}
                        className={`px-2 py-1 rounded transition-all ${mapViewMode === 'clusters' ? 'bg-zinc-950 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Clusters
                      </button>
                      <button
                        onClick={() => setMapViewMode('risk')}
                        className={`px-2 py-1 rounded transition-all ${mapViewMode === 'risk' ? 'bg-zinc-950 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Risks
                      </button>
                      <button
                        onClick={() => setMapViewMode('routes')}
                        className={`px-2 py-1 rounded transition-all ${mapViewMode === 'routes' ? 'bg-zinc-950 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Routes
                      </button>
                    </div>
                  </div>

                </div>

                {/* Left/Right Sidebar: Selected node inspectors & settings */}
                <div className="space-y-6 flex flex-col justify-between h-full" id="inspector-shelf-container">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded p-5 h-full flex flex-col justify-between">
                    
                    {/* Selected Node Details */}
                    <div>
                      <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 mb-4">
                        <Sliders className="text-orange-500" size={16} />
                        <h3 className="text-xs font-black text-zinc-400 tracking-widest uppercase">OBJECT INSPECTOR</h3>
                      </div>

                      {selectedShipment ? (
                        <div className="space-y-4 text-xs font-mono">
                          <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                            <span className="text-[9px] text-zinc-500 uppercase font-black">SHIPMENT ID</span>
                            <div className="text-zinc-200 font-bold">{selectedShipment.id}</div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Address:</span>
                              <span className="text-zinc-200 text-right truncate max-w-[140px] font-sans" title={selectedShipment.address}>
                                {selectedShipment.address}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Weight Load:</span>
                              <span className="text-zinc-200 font-bold">{selectedShipment.weight} lbs</span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Zone Cluster:</span>
                              <span className="text-zinc-200 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: depots[selectedShipment.clusterId % depots.length]?.zoneColor }}></span>
                                {depots[selectedShipment.clusterId % depots.length]?.name}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Priority Level:</span>
                              <span className={`font-bold px-1 rounded text-[10px] uppercase font-black ${
                                selectedShipment.priority === 'High' ? 'bg-red-950/50 text-red-400' : 'bg-zinc-800 text-zinc-300'
                              }`}>{selectedShipment.priority}</span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Status:</span>
                              <span className={`font-black uppercase ${selectedShipment.status === 'Disrupted' ? 'text-orange-500 animate-pulse' : 'text-zinc-300'}`}>
                                {selectedShipment.status}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Risk Factor:</span>
                              <span className={`font-bold ${selectedShipment.riskScore > 60 ? 'text-orange-500' : 'text-zinc-400'}`}>
                                {selectedShipment.riskScore}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500 font-bold">Current ETA:</span>
                              <span className="text-zinc-200 font-bold">{selectedShipment.etaMinutes} mins</span>
                            </div>
                          </div>
                        </div>
                      ) : selectedDepot ? (
                        <div className="space-y-4 text-xs font-mono">
                          <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                            <span className="text-[9px] text-zinc-500 font-black uppercase">FULFILLMENT DEPOT</span>
                            <div className="text-zinc-200 font-bold" style={{ color: selectedDepot.zoneColor }}>{selectedDepot.name}</div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Center:</span>
                              <span className="text-zinc-200">{selectedDepot.lat.toFixed(4)}, {selectedDepot.lng.toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Fulfillment Cap:</span>
                              <span className="text-zinc-200 font-bold">{selectedDepot.capacity} active</span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span className="text-zinc-500 font-bold">Allocated Fleet:</span>
                              <span className="text-zinc-200 font-bold">{selectedDepot.activeTrucks} trucks</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500 font-bold">Operational Load:</span>
                              <span className={`font-bold ${
                                (selectedDepot.activeTrucks / selectedDepot.capacity) > 0.85 ? 'text-orange-500' : 'text-zinc-400'
                              }`}>
                                {Math.round((selectedDepot.activeTrucks / selectedDepot.capacity) * 100)}% Stress
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-zinc-500 py-12 px-4 border border-dashed border-zinc-800 rounded bg-zinc-950/40">
                          <MapPin className="mx-auto mb-2 text-zinc-700" size={20} />
                          <p className="text-[10px] font-mono uppercase font-black tracking-widest text-zinc-600">Inspect Node</p>
                          <p className="text-[10px] text-zinc-500 mt-2 font-sans">Click on any customer node or depot hub on the map workspace to query its real-time telemetry profile.</p>
                        </div>
                      )}
                    </div>

                    {/* Actions and commands bar */}
                    <div className="pt-4 border-t border-zinc-800 space-y-3">
                      <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-black">Operational controls</div>
                      <button
                        onClick={triggerAnimationSolver}
                        disabled={isOptimizing}
                        className={`w-full py-3 rounded font-black text-xs flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider cursor-pointer ${
                          isOptimizing 
                            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                            : 'bg-orange-500 hover:bg-orange-400 text-black shadow-lg shadow-orange-500/10'
                        }`}
                      >
                        <Activity size={12} className={isOptimizing ? 'animate-spin' : ''} />
                        {isOptimizing ? 'TSP OPTIMIZING...' : 'RE-COMPUTE NETWORK'}
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {activePanel === 'benchmark' && (
              /* PANEL B: GPU BENCHMARK LAB */
              <BenchmarkPanel 
                onTriggerOptimization={triggerAnimationSolver} 
                isOptimizing={isOptimizing} 
              />
            )}

            {activePanel === 'bigquery' && (
              /* PANEL C: BIGQUERY STORAGE WORKSPACE */
              <BigQueryExplorer />
            )}
          </div>

        </div>

        {/* 3. PERMANENT GEMINI CO-PILOT SIDEBAR (Right Hand Side) */}
        <div className="w-[380px] shrink-0 border-l border-slate-800" id="copilot-sidebar-frame">
          <CopilotPanel
            metrics={currentMetrics}
            disruptions={disruptions}
            depots={depots}
            onApplyDepotAdjustments={handleApplyDepotAdjustments}
            activeTab={copilotTab}
            setActiveTab={setCopilotTab}
          />
        </div>

      </main>

    </div>
  );
}
