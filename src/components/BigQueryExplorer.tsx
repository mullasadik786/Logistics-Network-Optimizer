/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, Terminal, Play, BarChart2, Zap, Cpu, Server, Table } from 'lucide-react';
import { SQLQuery, BigQueryTable } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function BigQueryExplorer() {
  const [activeQueryId, setActiveQueryId] = useState<string>('q1');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMode, setExecutionMode] = useState<'standard' | 'accelerated'>('accelerated');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'Connected to BigQuery dataset: dev_corp_logistics_v4',
    'GPU acceleration layer initialized: Arrow-native BQ Storage API (v2.1)',
    'Ready for query processing.'
  ]);

  const tables: BigQueryTable[] = [
    { name: 'historical_delivery_events', rows: 45280391, sizeGb: 284.5, description: 'Fulfillment logs, GPS telemetry tracking, and stop-level dwell timings from 2024-2026.' },
    { name: 'depot_fleet_allocations', rows: 120500, sizeGb: 1.2, description: 'Fulfillment depot active driver rotas, vehicle payloads, and capacity metrics.' },
    { name: 'weather_road_hazards_merged', rows: 890430, sizeGb: 5.4, description: 'Merged historical municipal road closures and NOAA spatial weather feeds.' }
  ];

  const queries: SQLQuery[] = [
    {
      id: 'q1',
      title: 'Dwell Time Bottlenecks by Depot Hub',
      description: 'Identifies which fulfillment depots suffer from the longest vehicle dwell times, indicating dispatch bottlenecks or cargo loading friction.',
      sql: `SELECT 
  d.depot_name,
  AVG(h.stop_dwell_time_minutes) AS avg_dwell_minutes,
  COUNT(h.shipment_id) AS total_shipments_processed,
  SUM(CASE WHEN h.stop_dwell_time_minutes > 45 THEN 1 ELSE 0 END) AS extreme_dwell_incidents
FROM 
  \`dev_corp_logistics_v4.historical_delivery_events\` h
JOIN 
  \`dev_corp_logistics_v4.depot_fleet_allocations\` d ON h.depot_id = d.depot_id
WHERE 
  h.event_date >= CURRENT_DATE() - INTERVAL 90 DAY
GROUP BY 
  d.depot_name
ORDER BY 
  avg_dwell_minutes DESC;`,
      headers: ['Depot Name', 'Avg Dwell (Min)', 'Total Processed', 'Extreme Incidents (>45m)'],
      results: [
        { depot_name: 'SF Downtown (Depot-0)', avg_dwell_minutes: 38.2, total_shipments_processed: 124500, extreme_dwell_incidents: 12044 },
        { depot_name: 'South Bay Depot-2', avg_dwell_minutes: 32.4, total_shipments_processed: 284300, extreme_dwell_incidents: 15402 },
        { depot_name: 'East Bay Depot-1', avg_dwell_minutes: 24.1, total_shipments_processed: 310500, extreme_dwell_incidents: 6490 },
        { depot_name: 'Peninsula Depot-3', avg_dwell_minutes: 18.5, total_shipments_processed: 195200, extreme_dwell_incidents: 1902 },
      ],
      executionTimeMs: { standardCpu: 12400, bqStorageRapids: 350 }
    },
    {
      id: 'q2',
      title: 'Historical Delay Density by Spatial ZIP Zone',
      description: 'Finds ZIP zones with elevated delay risk factors by spatial partitioning. Directly generates inputs for shipment risk models.',
      sql: `SELECT 
  h.recipient_zip,
  COUNT(h.shipment_id) AS total_deliveries,
  ROUND(AVG(CASE WHEN h.delivery_status = 'Delayed' THEN h.eta_delay_minutes ELSE 0 END), 1) AS avg_eta_delay_mins,
  ROUND(SUM(CASE WHEN h.delivery_status = 'Delayed' THEN 1 ELSE 0 END) * 100.0 / COUNT(h.shipment_id), 2) AS delay_percentage
FROM 
  \`dev_corp_logistics_v4.historical_delivery_events\` h
WHERE 
  h.recipient_zip LIKE '941%' OR h.recipient_zip LIKE '943%'
GROUP BY 
  h.recipient_zip
HAVING 
  total_deliveries > 5000
ORDER BY 
  delay_percentage DESC
LIMIT 8;`,
      headers: ['ZIP Area Code', 'Total Deliveries', 'Avg ETA Delay (Min)', 'Delay Rate (%)'],
      results: [
        { recipient_zip: '94103 (SOMA)', total_deliveries: 42100, avg_eta_delay_mins: 28.4, delay_percentage: 18.50 },
        { recipient_zip: '94110 (Mission)', total_deliveries: 53200, avg_eta_delay_mins: 24.1, delay_percentage: 15.20 },
        { recipient_zip: '94107 (Potrero)', total_deliveries: 31200, avg_eta_delay_mins: 21.0, delay_percentage: 14.10 },
        { recipient_zip: '94301 (Palo Alto)', total_deliveries: 18400, avg_eta_delay_mins: 12.2, delay_percentage: 8.40 },
        { recipient_zip: '94111 (Fin District)', total_deliveries: 29000, avg_eta_delay_mins: 22.5, delay_percentage: 13.50 },
        { recipient_zip: '94112 (Excelsior)', total_deliveries: 34100, avg_eta_delay_mins: 10.4, delay_percentage: 6.20 },
      ],
      executionTimeMs: { standardCpu: 15200, bqStorageRapids: 410 }
    },
    {
      id: 'q3',
      title: 'Fulfillment Capacity & Fleet Stress Ratios',
      description: 'Calculates the historical fleet capacity stress ratios to allocate routing reserves prior to high-volume cycles.',
      sql: `SELECT 
  EXTRACT(MONTH FROM h.event_date) AS delivery_month,
  d.depot_name,
  AVG(d.fleet_utilization_ratio) AS avg_fleet_utilization,
  MAX(h.cargo_weight_lbs) AS max_cargo_weight,
  COUNT(h.shipment_id) AS monthly_shipment_volume
FROM 
  \`dev_corp_logistics_v4.historical_delivery_events\` h
JOIN 
  \`dev_corp_logistics_v4.depot_fleet_allocations\` d ON h.depot_id = d.depot_id
WHERE 
  h.event_date >= '2025-01-01'
GROUP BY 
  delivery_month, d.depot_name
ORDER BY 
  monthly_shipment_volume DESC, avg_fleet_utilization DESC;`,
      headers: ['Month Code', 'Depot Name', 'Fleet Util %', 'Max Load Weight (lbs)', 'Monthly Volume'],
      results: [
        { delivery_month: 'June', depot_name: 'SF Downtown (Depot-0)', avg_fleet_utilization: 0.91, max_cargo_weight: 12450, monthly_shipment_volume: 85200 },
        { delivery_month: 'June', depot_name: 'East Bay Depot-1', avg_fleet_utilization: 0.88, max_cargo_weight: 14200, monthly_shipment_volume: 98100 },
        { delivery_month: 'June', depot_name: 'South Bay Depot-2', avg_fleet_utilization: 0.85, max_cargo_weight: 11050, monthly_shipment_volume: 72400 },
        { delivery_month: 'May', depot_name: 'SF Downtown (Depot-0)', avg_fleet_utilization: 0.86, max_cargo_weight: 12100, monthly_shipment_volume: 79200 },
        { delivery_month: 'May', depot_name: 'East Bay Depot-1', avg_fleet_utilization: 0.84, max_cargo_weight: 13900, monthly_shipment_volume: 89400 },
      ],
      executionTimeMs: { standardCpu: 18400, bqStorageRapids: 490 }
    }
  ];

  const activeQuery = queries.find(q => q.id === activeQueryId) || queries[0];

  const handleExecuteQuery = () => {
    setIsExecuting(true);
    setConsoleLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Query submitted: "${activeQuery.title}"`,
      `[${new Date().toLocaleTimeString()}] Accessing BigQuery cluster partition on Google Cloud...`,
    ]);

    const delay = executionMode === 'standard' ? 2500 : 400;

    setTimeout(() => {
      setIsExecuting(false);
      setConsoleLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Query completed successfully.`,
        `[${new Date().toLocaleTimeString()}] Ingested ${activeQuery.results.length} rows using Arrow chunk parser.`,
        `[${new Date().toLocaleTimeString()}] Execution timing: ${
          executionMode === 'standard' 
            ? `${activeQuery.executionTimeMs.standardCpu}ms (standard CPU serialize)` 
            : `${activeQuery.executionTimeMs.bqStorageRapids}ms (NVIDIA RAPIDS Arrow direct bypass)`
        }`,
      ]);
    }, delay);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full" id="bigquery-explorer-container">
      {/* Sidebar: Table Catalog & Query Selectors */}
      <div className="xl:col-span-1 space-y-5 bg-zinc-900/50 border border-zinc-800 rounded p-4 flex flex-col justify-between">
        <div className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
            <Database className="text-orange-500" size={18} />
            <h3 className="text-sm font-black text-zinc-100 uppercase tracking-wider">BIGQUERY WAREHOUSE</h3>
          </div>

          {/* Tables catalog list */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest block">Schema Tables</span>
            <div className="space-y-2">
              {tables.map((t) => (
                <div key={t.name} className="bg-zinc-950 p-2.5 rounded border border-zinc-800 text-[11px] font-mono">
                  <div className="flex justify-between items-center text-zinc-200 font-bold mb-1">
                    <span className="truncate max-w-[120px]">{t.name}</span>
                    <span className="text-[9px] text-orange-500 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded font-black uppercase">{(t.sizeGb).toFixed(1)} GB</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mb-1 font-bold">ROWS: {t.rows.toLocaleString()}</div>
                  <p className="text-[10px] text-zinc-400 font-sans leading-snug line-clamp-2">{t.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Preset queries selection */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest block">Preset Analyses</span>
            {queries.map((q) => (
              <button
                key={q.id}
                onClick={() => setActiveQueryId(q.id)}
                className={`w-full text-left p-2.5 rounded border text-xs transition-all ${
                  activeQueryId === q.id
                    ? 'bg-zinc-950 border-orange-500 text-orange-500 font-bold'
                    : 'bg-zinc-950/50 hover:bg-zinc-950 border-zinc-800 text-zinc-400 font-bold'
                }`}
              >
                <div className="font-mono truncate">{q.title}</div>
                <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5 font-sans font-normal">{q.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Acceleration Mode Toggle */}
        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded space-y-2 mt-4">
          <span className="text-[9px] font-mono font-black text-zinc-500 uppercase tracking-widest block">Ingestion Pipeline Mode</span>
          <div className="grid grid-cols-2 gap-1.5 bg-zinc-900 p-1 rounded border border-zinc-800">
            <button
              onClick={() => setExecutionMode('standard')}
              className={`py-1.5 px-1.5 text-[10px] font-mono font-black rounded transition-all flex items-center justify-center gap-1 uppercase ${
                executionMode === 'standard'
                  ? 'bg-zinc-800 text-amber-500 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Cpu size={10} /> CPU Pandas
            </button>
            <button
              onClick={() => setExecutionMode('accelerated')}
              className={`py-1.5 px-1.5 text-[10px] font-mono font-black rounded transition-all flex items-center justify-center gap-1 uppercase ${
                executionMode === 'accelerated'
                  ? 'bg-zinc-950 text-orange-500 border border-zinc-800 shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Zap size={10} /> cuDF Arrow
            </button>
          </div>
        </div>
      </div>

      {/* Main Console, Query Editor & Results Panel */}
      <div className="xl:col-span-3 space-y-6 flex flex-col h-full" id="bigquery-console-workspace">
        {/* SQL Query Editor Frame */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded overflow-hidden flex flex-col">
          <div className="bg-zinc-950 px-4 py-2.5 flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center gap-1.5">
              <Terminal size={14} className="text-zinc-450" />
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">BQ-CONSOLE://Query_Editor.sql</span>
            </div>
            <button
              onClick={handleExecuteQuery}
              disabled={isExecuting}
              className={`px-3 py-1.5 text-xs font-black rounded flex items-center gap-1.5 transition-all uppercase tracking-wider cursor-pointer ${
                isExecuting
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-400 text-black shadow-md'
              }`}
            >
              <Play size={10} className={isExecuting ? 'animate-spin' : ''} />
              {isExecuting ? 'RUNNING...' : 'RUN QUERY'}
            </button>
          </div>

          <div className="p-4 bg-zinc-950/80 font-mono text-xs text-orange-500/95 leading-relaxed overflow-x-auto whitespace-pre h-44 border border-zinc-800 rounded-b">
            {activeQuery.sql}
          </div>
        </div>

        {/* Results Data Grid & Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          {/* Query Result Grid */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4 flex flex-col h-[320px]">
            <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-800 mb-2">
              <Table size={14} className="text-zinc-500" />
              <h4 className="text-xs font-mono font-black tracking-widest text-zinc-450 uppercase">QUERY RESULT GRID</h4>
            </div>

            <div className="flex-1 overflow-auto border border-zinc-800 rounded">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="bg-zinc-950 text-zinc-500 border-b border-zinc-800">
                    {activeQuery.headers.map((h, i) => (
                      <th key={i} className="p-2 font-bold uppercase border-r border-zinc-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-300">
                  {activeQuery.results.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-950">
                      {Object.values(row).map((val, k) => (
                        <td key={k} className="p-2 border-r border-zinc-800 max-w-[140px] truncate">
                          {typeof val === 'number' 
                            ? val.toLocaleString() 
                            : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visualization of query */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4 flex flex-col h-[320px]">
            <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-800 mb-2">
              <BarChart2 size={14} className="text-zinc-500" />
              <h4 className="text-xs font-mono font-black tracking-widest text-zinc-450 uppercase">QUERY VISUALIZER</h4>
            </div>

            <div className="flex-1 w-full bg-zinc-950/50 p-2 rounded border border-zinc-800">
              <ResponsiveContainer width="100%" height="100%">
                {activeQueryId === 'q1' ? (
                  <BarChart data={activeQuery.results} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="depot_name" stroke="#52525b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={9} tickLine={false} unit="m" />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                    <Bar dataKey="avg_dwell_minutes" fill="#f97316" radius={[2, 2, 0, 0]} name="Avg Dwell Time" />
                  </BarChart>
                ) : activeQueryId === 'q2' ? (
                  <BarChart data={activeQuery.results} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="recipient_zip" stroke="#52525b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={9} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                    <Bar dataKey="delay_percentage" fill="#f97316" radius={[2, 2, 0, 0]} name="Delay Rate" />
                  </BarChart>
                ) : (
                  <LineChart data={activeQuery.results} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="depot_name" stroke="#52525b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                    <Legend fontSize={9} />
                    <Line type="monotone" dataKey="avg_fleet_utilization" stroke="#f97316" activeDot={{ r: 6 }} name="Fleet Utilization" />
                    <Line type="monotone" dataKey="monthly_shipment_volume" stroke="#a1a1aa" name="Volume (/10)" />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Console Logs overlay */}
        <div className="bg-zinc-950 border border-zinc-800 rounded p-3 font-mono text-[10px] text-zinc-400 space-y-1 h-28 overflow-y-auto">
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-1 mb-1 font-bold">
            <Server size={10} /> PIPELINE TELEMETRY OUTPUT
          </div>
          {consoleLogs.map((log, i) => (
            <div key={i} className="line-clamp-1">
              <span className="text-zinc-700 font-bold">&gt;</span> {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
