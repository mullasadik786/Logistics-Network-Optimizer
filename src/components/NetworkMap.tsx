/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Shipment, Depot, RouteDisruption } from '../types';
import { MapPin, ShieldAlert, PlusCircle, Navigation, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface NetworkMapProps {
  shipments: Shipment[];
  depots: Depot[];
  disruptions: RouteDisruption[];
  selectedShipment: Shipment | null;
  selectedDepot: Depot | null;
  onSelectShipment: (shipment: Shipment | null) => void;
  onSelectDepot: (depot: Depot | null) => void;
  onAddDisruption: (disruption: RouteDisruption) => void;
  isOptimizing: boolean;
  viewMode: 'clusters' | 'risk' | 'routes';
}

export default function NetworkMap({
  shipments,
  depots,
  disruptions,
  selectedShipment,
  selectedDepot,
  onSelectShipment,
  onSelectDepot,
  onAddDisruption,
  isOptimizing,
  viewMode,
}: NetworkMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pan and Zoom states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Custom Disruption placement states
  const [disruptionMode, setDisruptionMode] = useState<RouteDisruption['type'] | null>(null);
  const [disruptionSeverity, setDisruptionSeverity] = useState<RouteDisruption['severity']>('Major');

  // Map Bounds for mapping lat/lng to canvas coords
  // San Francisco Bay Area bounding box
  const minLat = 37.2;
  const maxLat = 37.9;
  const minLng = -122.6;
  const maxLng = -121.7;

  // Track animation frame
  useEffect(() => {
    let animationFrameId: number;
    let pulseTime = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      pulseTime += 0.05;

      // Clear canvas
      ctx.fillStyle = '#09090b'; // Zinc 950
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Apply Pan & Zoom
      ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Map lat/lng to canvas coords
      const toCanvasCoords = (lat: number, lng: number) => {
        const x = ((lng - minLng) / (maxLng - minLng)) * canvas.width;
        // Flip y because canvas y goes down, lat goes up
        const y = (1 - (lat - minLat) / (maxLat - minLat)) * canvas.height;
        return { x, y };
      };

      // 1. Draw Bounding Grid Lines
      ctx.strokeStyle = '#18181b'; // Zinc 900
      ctx.lineWidth = 1;
      const gridSize = 10;
      for (let i = 0; i <= gridSize; i++) {
        const x = (i / gridSize) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();

        const y = (i / gridSize) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Draw Disruption Zones (translucent red circles)
      disruptions.forEach((dis) => {
        const coords = toCanvasCoords(dis.lat, dis.lng);
        const radiusInPixels = dis.radius * canvas.width * 2; // scale factor

        // Animated pulsing effect
        const pulse = 1 + 0.1 * Math.sin(pulseTime * 2);
        const rad = radiusInPixels * pulse;

        // Radial gradient for smooth disaster field
        const grad = ctx.createRadialGradient(coords.x, coords.y, 0, coords.x, coords.y, rad);
        if (dis.severity === 'Critical') {
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
          grad.addColorStop(0.7, 'rgba(239, 68, 68, 0.15)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        } else if (dis.severity === 'Major') {
          grad.addColorStop(0, 'rgba(249, 115, 22, 0.4)');
          grad.addColorStop(0.7, 'rgba(249, 115, 22, 0.12)');
          grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
        } else {
          grad.addColorStop(0, 'rgba(234, 179, 8, 0.35)');
          grad.addColorStop(0.7, 'rgba(234, 179, 8, 0.1)');
          grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 3. Draw Route Lines if in route mode
      if (viewMode === 'routes') {
        depots.forEach((depot) => {
          const depotCoords = toCanvasCoords(depot.lat, depot.lng);
          const depotShipments = shipments.filter(s => s.clusterId === Number(depot.id.split('-')[1] || 0));

          // Draw spider routes connecting to depot
          ctx.beginPath();
          ctx.strokeStyle = `${depot.zoneColor}22`; // Very translucent zone color
          ctx.lineWidth = 1;
          depotShipments.forEach((shipment) => {
            const shipCoords = toCanvasCoords(shipment.lat, shipment.lng);
            ctx.moveTo(depotCoords.x, depotCoords.y);
            ctx.lineTo(shipCoords.x, shipCoords.y);
          });
          ctx.stroke();

          // Draw an animated flowing pulse line along optimized TSP paths
          if (isOptimizing) {
            ctx.strokeStyle = '#f97316'; // Orange pulse
            ctx.lineWidth = 1.5;
            depotShipments.slice(0, 15).forEach((shipment, idx) => {
              const shipCoords = toCanvasCoords(shipment.lat, shipment.lng);
              const flowProgress = (pulseTime + idx * 0.2) % 1.0;
              const flowX = depotCoords.x + (shipCoords.x - depotCoords.x) * flowProgress;
              const flowY = depotCoords.y + (shipCoords.y - depotCoords.y) * flowProgress;

              ctx.fillStyle = '#ea580c';
              ctx.beginPath();
              ctx.arc(flowX, flowY, 3, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        });
      }

      // 4. Draw Shipments (dots)
      shipments.forEach((shipment) => {
        const coords = toCanvasCoords(shipment.lat, shipment.lng);
        let color = '#f97316'; // Orange default
        let radius = 2.5;

        // Choose color based on view mode
        if (viewMode === 'clusters') {
          // Color based on depot assignment (cluster ID)
          const depot = depots[shipment.clusterId % depots.length];
          color = depot ? depot.zoneColor : '#52525b';
        } else if (viewMode === 'risk') {
          // Color based on Risk Score
          if (shipment.riskScore > 70) {
            color = '#ef4444'; // Red
            radius = 3.5;
          } else if (shipment.riskScore > 40) {
            color = '#f97316'; // Orange
            radius = 3.0;
          } else {
            color = '#52525b'; // Zinc neutral
          }
        } else if (viewMode === 'routes') {
          // Faded nodes unless selected
          const depot = depots[shipment.clusterId % depots.length];
          color = depot ? `${depot.zoneColor}cc` : '#52525b';
        }

        // Highlight selected shipment
        const isSelected = selectedShipment && selectedShipment.id === shipment.id;
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ffffff';
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(coords.x, coords.y, radius * 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Draw Depot Hubs (larger markers)
      depots.forEach((depot) => {
        const coords = toCanvasCoords(depot.lat, depot.lng);

        // Highlight selected depot
        const isSelected = selectedDepot && selectedDepot.id === depot.id;
        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(coords.x, coords.y, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Animated pulse ring around depots to show capacity pressure
        const loadRatio = depot.activeTrucks / depot.capacity;
        const ringColor = loadRatio > 0.85 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.2)';
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 18 + 4 * Math.sin(pulseTime * 1.5), 0, Math.PI * 2);
        ctx.stroke();

        // Outer Hexagon or Square
        ctx.fillStyle = depot.zoneColor;
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(coords.x - 8, coords.y - 8, 16, 16);
        ctx.fill();
        ctx.stroke();

        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Depot Labels
        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 9px "Outfit", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(depot.name.toUpperCase(), coords.x, coords.y - 13);
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [shipments, depots, disruptions, zoom, pan, selectedShipment, selectedDepot, viewMode, isOptimizing]);

  // Handle Resize of Container to fit Canvas
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Map coordinate helpers for mouse events
  const getMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Inverse of Translate & Scale to find raw canvas coordinates
    // tx = canvas.width / 2 + pan.x, ty = canvas.height / 2 + pan.y
    const rawX = (x - (canvas.width / 2 + pan.x)) / zoom + canvas.width / 2;
    const rawY = (y - (canvas.height / 2 + pan.y)) / zoom + canvas.height / 2;

    return { x: rawX, y: rawY };
  };

  const toLatLng = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { lat: 37.5, lng: -122.2 };

    const lng = minLng + (x / canvas.width) * (maxLng - minLng);
    const lat = minLat + (1 - y / canvas.height) * (maxLat - minLat);
    return { lat, lng };
  };

  // Dragging / Panning handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If disruption placement mode is active, do not pan. Trigger placement instead.
    if (disruptionMode) {
      const coords = getMouseCoords(e);
      if (coords) {
        const { lat, lng } = toLatLng(coords.x, coords.y);
        const radius = disruptionSeverity === 'Critical' ? 0.08 : disruptionSeverity === 'Major' ? 0.05 : 0.03;
        const newDis: RouteDisruption = {
          id: `dis-${Date.now()}`,
          lat,
          lng,
          radius,
          type: disruptionMode,
          severity: disruptionSeverity,
          description: `User-defined ${disruptionSeverity.toLowerCase()} ${disruptionMode.toLowerCase()} disruption.`,
        };
        onAddDisruption(newDis);
        setDisruptionMode(null); // Reset mode after placement
      }
      return;
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);

    // If it was a quick click (no drag), search for elements nearby
    const coords = getMouseCoords(e);
    if (!coords || disruptionMode) return;

    const { lat, lng } = toLatLng(coords.x, coords.y);

    // Check if clicked depot
    const clickedDepot = depots.find((depot) => {
      const distance = Math.sqrt(Math.pow(depot.lat - lat, 2) + Math.pow(depot.lng - lng, 2));
      return distance < 0.015; // spatial tolerance
    });

    if (clickedDepot) {
      onSelectDepot(clickedDepot);
      onSelectShipment(null);
      return;
    }

    // Check if clicked shipment
    const clickedShipment = shipments.find((shipment) => {
      const distance = Math.sqrt(Math.pow(shipment.lat - lat, 2) + Math.pow(shipment.lng - lng, 2));
      return distance < 0.004; // small spatial tolerance
    });

    if (clickedShipment) {
      onSelectShipment(clickedShipment);
      onSelectDepot(null);
    } else {
      // Clear selections if clicked on empty space
      onSelectShipment(null);
      onSelectDepot(null);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.3, 15));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.3, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="relative flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded overflow-hidden" id="spatial-canvas-container">
      {/* Map Control bar */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 items-center bg-zinc-900 border border-zinc-800 p-2 rounded shadow-xl backdrop-blur-md">
        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleResetView}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition-colors border-r border-zinc-800 pr-2 cursor-pointer"
          title="Reset View"
        >
          <RotateCcw size={16} />
        </button>

        {/* Custom Disruption Injector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-mono font-black tracking-widest text-zinc-500 pl-1">Inject Risk:</span>
          {(['Weather', 'Accident', 'Construction', 'Traffic Congestion'] as RouteDisruption['type'][]).map((type) => (
            <button
              key={type}
              onClick={() => setDisruptionMode(disruptionMode === type ? null : type)}
              className={`px-2 py-1 text-xs rounded border transition-all flex items-center gap-1 font-mono uppercase font-black tracking-wider cursor-pointer ${
                disruptionMode === type
                  ? 'bg-orange-500/10 border-orange-500 text-orange-500 animate-pulse'
                  : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
            >
              <PlusCircle size={10} />
              {type.split(' ')[0]}
            </button>
          ))}
        </div>

        {disruptionMode && (
          <div className="flex items-center gap-1 pl-2 border-l border-zinc-800 ml-1">
            <span className="text-[10px] font-mono text-zinc-500 font-bold">Severity:</span>
            {(['Critical', 'Major', 'Minor'] as RouteDisruption['severity'][]).map((sev) => (
              <button
                key={sev}
                onClick={() => setDisruptionSeverity(sev)}
                className={`px-1.5 py-0.5 text-[10px] font-black uppercase rounded ${
                  disruptionSeverity === sev
                    ? 'bg-orange-500 text-black font-bold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Disruption instructions banner */}
      {disruptionMode && (
        <div className="absolute top-16 left-3 right-3 z-10 flex items-center gap-2 bg-orange-950/90 border border-orange-800 p-2.5 rounded text-xs text-orange-200 shadow-lg animate-bounce">
          <ShieldAlert size={14} className="text-orange-500 shrink-0" />
          <span><strong>INFILTRATION MODE ACTIVE:</strong> Click anywhere on the map to inject a <strong>{disruptionSeverity.toUpperCase()} {disruptionMode.toUpperCase()}</strong> hazard. GPU paths will instantly compute routes bypassing the hazard zone.</span>
        </div>
      )}

      {/* Primary Canvas Container */}
      <div ref={containerRef} className="flex-1 w-full h-full cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="block w-full h-full"
        />
      </div>

      {/* Legend & Summary Overlay */}
      <div className="absolute bottom-3 left-3 z-10 bg-zinc-900/95 border border-zinc-800 p-3 rounded shadow-xl backdrop-blur-md text-[11px] font-mono w-64">
        <div className="font-black text-zinc-200 mb-2 pb-1.5 border-b border-zinc-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Navigation size={12} className="text-orange-500" />
          <span>NETWORK MAP LEGEND</span>
        </div>
        
        <div className="space-y-1.5 text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-zinc-100 rounded border border-zinc-950"></div>
            <span>Fulfillment Depot Hub</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
            </div>
            <span>Shipments (Clustered or Risk Level)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-red-500/10 border border-dashed border-red-500 rounded-full"></div>
            <span>Disruption Area (Dynamic Hazard)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-orange-500/40"></div>
            <span>Optimized Delivery Path Links</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-500">
          <span>CENTER: SF METRO GRID</span>
          <span>NODES: {shipments.length}</span>
        </div>
      </div>
    </div>
  );
}
