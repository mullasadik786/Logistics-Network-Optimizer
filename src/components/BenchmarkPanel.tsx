/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BenchmarkStats } from '../types';
import { Cpu, Zap, BarChart2, TrendingUp, Info, HelpCircle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BenchmarkPanelProps {
  onTriggerOptimization: () => void;
  isOptimizing: boolean;
}

export default function BenchmarkPanel({ onTriggerOptimization, isOptimizing }: BenchmarkPanelProps) {
  const [dataScale, setDataScale] = useState<number>(10000);
  const [algorithm, setAlgorithm] = useState<'K-Means Clustering' | 'TSP Path Finding' | 'Spatial Join (cuDF)'>('TSP Path Finding');
  const [running, setRunning] = useState(false);
  const [progressCpu, setProgressCpu] = useState(0);
  const [progressGpu, setProgressGpu] = useState(0);
  
  // Historical stats log
  const [stats, setStats] = useState<BenchmarkStats[]>([
    { algorithm: 'TSP Path Finding', nodes: 5000, cpuTimeMs: 1450, gpuTimeMs: 12, speedup: 120.8, cpuThroughput: 3448, gpuThroughput: 416666 },
    { algorithm: 'K-Means Clustering', nodes: 10000, cpuTimeMs: 2980, gpuTimeMs: 18, speedup: 165.5, cpuThroughput: 3355, gpuThroughput: 555555 },
    { algorithm: 'Spatial Join (cuDF)', nodes: 25000, cpuTimeMs: 7650, gpuTimeMs: 44, speedup: 173.8, cpuThroughput: 3267, gpuThroughput: 568181 },
  ]);

  const [currentResult, setCurrentResult] = useState<BenchmarkStats | null>({
    algorithm: 'TSP Path Finding',
    nodes: 10000,
    cpuTimeMs: 2850,
    gpuTimeMs: 16,
    speedup: 178.1,
    cpuThroughput: 3508,
    gpuThroughput: 625000
  });

  const runBenchmark = () => {
    setRunning(true);
    setProgressCpu(0);
    setProgressGpu(0);
    onTriggerOptimization();

    // Calculate simulated results based on scale and algorithm
    const scaleFactor = dataScale / 10000;
    const algoBaseTimeCpu = algorithm === 'TSP Path Finding' ? 2800 : algorithm === 'K-Means Clustering' ? 3000 : 2200;
    const algoBaseTimeGpu = algorithm === 'TSP Path Finding' ? 16 : algorithm === 'K-Means Clustering' ? 18 : 12;

    const simulatedCpuTime = Math.round(algoBaseTimeCpu * scaleFactor * (0.9 + Math.random() * 0.2));
    const simulatedGpuTime = Math.max(2, Math.round(algoBaseTimeGpu * Math.pow(scaleFactor, 0.7) * (0.8 + Math.random() * 0.3)));
    const speedup = Number((simulatedCpuTime / simulatedGpuTime).toFixed(1));

    // Trigger GPU progress (almost instantaneous)
    const gpuInterval = setInterval(() => {
      setProgressGpu((prev) => {
        if (prev >= 100) {
          clearInterval(gpuInterval);
          return 100;
        }
        return prev + 25;
      });
    }, 40);

    // Trigger CPU progress (slower, simulated)
    const totalCpuSteps = 20;
    const stepDuration = simulatedCpuTime / totalCpuSteps;
    let stepCount = 0;

    const cpuInterval = setInterval(() => {
      stepCount++;
      setProgressCpu(Math.round((stepCount / totalCpuSteps) * 100));

      if (stepCount >= totalCpuSteps) {
        clearInterval(cpuInterval);
        setRunning(false);

        const newStat: BenchmarkStats = {
          algorithm,
          nodes: dataScale,
          cpuTimeMs: simulatedCpuTime,
          gpuTimeMs: simulatedGpuTime,
          speedup,
          cpuThroughput: Math.round((dataScale / simulatedCpuTime) * 1000),
          gpuThroughput: Math.round((dataScale / simulatedGpuTime) * 1000),
        };

        setCurrentResult(newStat);
        setStats((prev) => [newStat, ...prev.slice(0, 5)]); // Keep last 6 stats
      }
    }, stepDuration);
  };

  const chartData = stats.map((s) => ({
    name: `${s.nodes.toLocaleString()} pts`,
    speedup: s.speedup,
    algo: s.algorithm,
  })).reverse();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full" id="benchmark-panel-container">
      {/* 1. Benchmark Settings & Control */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded p-5 flex flex-col justify-between" id="benchmark-controls">
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="text-orange-500" size={20} />
            <h2 className="text-base font-black text-zinc-100 tracking-wider uppercase">RAPIDS BENCHMARK SUITE</h2>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            Configure the spatial data scales to simulate multi-depot routing. Watch standard single-threaded CPU operations throttle compared to parallelized NVIDIA Tensor-Core processing.
          </p>

          {/* Algorithm selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest block">Parallel Algorithm</label>
            <div className="grid grid-cols-1 gap-2">
              {(['TSP Path Finding', 'K-Means Clustering', 'Spatial Join (cuDF)'] as const).map((algo) => (
                <button
                  key={algo}
                  disabled={running}
                  onClick={() => setAlgorithm(algo)}
                  className={`px-3 py-2.5 text-left text-xs rounded border transition-all flex items-center justify-between font-mono ${
                    algorithm === algo
                      ? 'bg-zinc-950 border-orange-500/75 text-orange-500 font-bold'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <span>{algo}</span>
                  {algorithm === algo && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Dataset Scale Selector */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Dataset Density</label>
              <span className="text-xs font-mono text-orange-500 font-bold">{(dataScale).toLocaleString()} Shipments</span>
            </div>
            <input
              type="range"
              min={1000}
              max={50000}
              step={1000}
              disabled={running}
              value={dataScale}
              onChange={(e) => setDataScale(Number(e.target.value))}
              className="w-full accent-orange-500 h-1.5 bg-zinc-950 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>1K (SPARSE)</span>
              <span>10K (MEDIUM)</span>
              <span>50K (ULTRA DENSITY)</span>
            </div>
          </div>

          {/* Benchmark execution displays */}
          {running && (
            <div className="space-y-3 bg-zinc-950 border border-zinc-800 p-3 rounded animate-pulse">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-orange-500 flex items-center gap-1 font-bold">
                    <Zap size={10} /> NVIDIA RAPIDS GPU (CUDF)
                  </span>
                  <span className="text-zinc-300 font-bold">{progressGpu}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-orange-500 h-1.5 rounded-full transition-all duration-75" style={{ width: `${progressGpu}%` }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-amber-500 flex items-center gap-1 font-bold">
                    <Cpu size={10} /> CPU HOST (PANDAS BASELINE)
                  </span>
                  <span className="text-zinc-300 font-bold">{progressCpu}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-75" style={{ width: `${progressCpu}%` }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={runBenchmark}
          disabled={running}
          className={`w-full py-3.5 px-4 rounded font-black text-xs flex items-center justify-center gap-2 transition-all mt-4 uppercase tracking-wider cursor-pointer ${
            running
              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-400 text-black shadow-lg shadow-orange-500/10'
          }`}
        >
          <Zap size={14} className={running ? 'animate-bounce' : 'animate-pulse'} />
          {running ? 'COMPUTING SPATIAL GRAPH...' : 'EXECUTE NVIDIA RAPIDS CORE'}
        </button>
      </div>

      {/* 2. Benchmark Live Results and Charts */}
      <div className="lg:col-span-2 space-y-6 flex flex-col justify-between" id="benchmark-results">
        {/* Results Metrics Panel */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded p-5 flex-1">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
            <h3 className="text-xs font-black text-zinc-400 tracking-widest uppercase flex items-center gap-1.5 font-mono">
              <TrendingUp size={14} className="text-orange-500" /> ACTIVE SOLVER STATS
            </h3>
            {currentResult && (
              <span className="text-[10px] font-mono text-orange-500 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded flex items-center gap-1 uppercase font-bold">
                <CheckCircle2 size={10} /> Simulation Stable
              </span>
            )}
          </div>

          {currentResult ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Speedup Box */}
              <div className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-[0.02]">
                  <Zap size={100} className="text-orange-500" />
                </div>
                <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">GPU ACCELERATION FACTOR</span>
                <div className="my-2 flex items-baseline gap-1.5">
                  <span className="text-5xl font-black text-orange-500 tracking-tighter leading-none">
                    {currentResult.speedup}x
                  </span>
                  <span className="text-xs font-mono text-orange-600 font-bold">FASTER</span>
                </div>
                <span className="text-[10px] text-zinc-400 line-clamp-2">
                  Completed {currentResult.nodes.toLocaleString()} node spatial routing index in {currentResult.gpuTimeMs}ms.
                </span>
              </div>

              {/* Execution times box */}
              <div className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col justify-between">
                <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">EXECUTION DURATION</span>
                <div className="my-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-amber-500 font-mono font-bold flex items-center gap-1">
                      <Cpu size={10} /> CPU:
                    </span>
                    <span className="text-sm font-bold text-zinc-250 font-mono">
                      {currentResult.cpuTimeMs} ms
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-zinc-900 pt-1">
                    <span className="text-xs text-orange-500 font-mono font-bold flex items-center gap-1">
                      <Zap size={10} /> GPU:
                    </span>
                    <span className="text-sm font-bold text-zinc-200 font-mono">
                      {currentResult.gpuTimeMs} ms
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500">
                  Calculated based on floating-point distance indices.
                </span>
              </div>

              {/* Throughput comparison box */}
              <div className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col justify-between">
                <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">THROUGHPUT RATIO</span>
                <div className="my-2 space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-zinc-500">
                    <span>CPU:</span>
                    <span className="font-mono text-zinc-400 font-bold">
                      {currentResult.cpuThroughput.toLocaleString()} pts/s
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-orange-500 font-bold">
                    <span>GPU RAPIDS:</span>
                    <span className="font-mono">
                      {currentResult.gpuThroughput.toLocaleString()} pts/s
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500">
                  Millions of spatial calculations synchronized per block.
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-800 rounded py-12 px-4 text-center text-zinc-500 my-4 flex flex-col items-center justify-center">
              <BarChart2 size={32} className="text-zinc-700 mb-2 stroke-[1.5]" />
              <p className="text-xs font-mono font-black tracking-widest uppercase">NO BENCHMARK RECORDED YET</p>
              <p className="text-[10px] text-zinc-600 mt-1 max-w-xs font-sans">Select a spatial scale and execute the solver to populate dynamic telemetry counters.</p>
            </div>
          )}

          {/* Historical Log & Graphic */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Acceleration Scale history</h4>
            <div className="h-44 w-full bg-zinc-950 rounded p-2 border border-zinc-800">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} unit="x" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }}
                    labelStyle={{ color: '#71717a', fontFamily: 'monospace', fontSize: 11 }}
                    itemStyle={{ color: '#f97316', fontFamily: 'monospace', fontSize: 11 }}
                  />
                  <Bar dataKey="speedup" fill="#f97316">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#ea580c' : '#f97316'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* NVIDIA RAPIDS architectural explanation card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4 flex gap-3 items-start">
          <Info className="text-orange-500 shrink-0 mt-0.5" size={16} />
          <div className="space-y-1">
            <h4 className="text-xs font-black tracking-wider text-zinc-200 uppercase font-mono">How does GPU acceleration bypass standard CPU bottlenecks?</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Logistics algorithms like **Traveling Salesperson (TSP)** have an O(N!) or O(2^N) complexity. On standard CPUs, looping through distance matrix indices runs on a single core, causing significant processing bottlenecks for fleets. NVIDIA **cuDF** keeps tables column-oriented in GPU memory, while **cuGraph** computes millions of nodes in parallel via dedicated kernels. When loaded from **BigQuery** using high-speed Arrow serialization, routing updates complete in milliseconds, allowing operational responsiveness.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
