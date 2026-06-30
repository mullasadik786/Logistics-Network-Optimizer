/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Shipment {
  id: string;
  lat: number;
  lng: number;
  status: 'Pending' | 'Routed' | 'In Transit' | 'Delivered' | 'Disrupted';
  priority: 'High' | 'Medium' | 'Low';
  weight: number; // in lbs
  clusterId: number;
  address: string;
  riskScore: number; // 0 to 100
  etaMinutes: number;
  dwellTimeMinutes: number;
}

export interface Depot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  activeTrucks: number;
  zoneColor: string;
  radiusKm: number;
}

export interface RouteDisruption {
  id: string;
  lat: number;
  lng: number;
  radius: number; // in degrees / map units
  type: 'Weather' | 'Accident' | 'Construction' | 'Traffic Congestion';
  severity: 'Critical' | 'Major' | 'Minor';
  description: string;
}

export interface BenchmarkStats {
  algorithm: string;
  nodes: number;
  cpuTimeMs: number;
  gpuTimeMs: number;
  speedup: number;
  cpuThroughput: number; // nodes/sec
  gpuThroughput: number; // nodes/sec
}

export interface BigQueryTable {
  name: string;
  rows: number;
  sizeGb: number;
  description: string;
}

export interface SQLQuery {
  id: string;
  title: string;
  description: string;
  sql: string;
  headers: string[];
  results: Record<string, any>[];
  executionTimeMs: {
    standardCpu: number;
    bqStorageRapids: number;
  };
}

export interface GeminiRecommendation {
  summary: string;
  actions: {
    title: string;
    description: string;
    impact: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  }[];
  depotAdjustments: {
    depotId: string;
    reallocatedTrucks: number;
    reason: string;
  }[];
}
