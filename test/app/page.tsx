"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// 그룹별 색상 및 메타데이터 정의
interface GroupConfig {
  id: number;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

const GROUPS_CONFIG: GroupConfig[] = [
  { id: 0, name: "그룹 A", color: "#3b82f6", bgColor: "bg-blue-500", borderColor: "border-blue-500", textColor: "text-blue-500" },
  { id: 1, name: "그룹 B", color: "#ef4444", bgColor: "bg-red-500", borderColor: "border-red-500", textColor: "text-red-500" },
  { id: 2, name: "그룹 C", color: "#10b981", bgColor: "bg-emerald-500", borderColor: "border-emerald-500", textColor: "text-emerald-500" },
  { id: 3, name: "그룹 D", color: "#8b5cf6", bgColor: "bg-purple-500", borderColor: "border-purple-500", textColor: "text-purple-500" },
  { id: 4, name: "그룹 E", color: "#f59e0b", bgColor: "bg-amber-500", borderColor: "border-amber-500", textColor: "text-amber-500" },
];

interface Point {
  id: string;
  x: number; // 0 ~ 1 정규화 좌표
  y: number; // 0 ~ 1 정규화 좌표
  groupId: number;
}

interface NeighborInfo {
  point: Point;
  distance: number;
}

// 가우시안 랜덤 생성 (클러스터링용)
function randomGaussian(mean: number, stdDev: number) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdDev + mean;
}

// 기본 클러스터 데이터셋 생성
function generateDefaultDataset(numGroups: number, pointsPerGroup = 15): Point[] {
  const points: Point[] = [];
  const centers: { x: number; y: number }[] = [
    { x: 0.28, y: 0.32 }, // 그룹 A (좌상단)
    { x: 0.72, y: 0.28 }, // 그룹 B (우상단)
    { x: 0.32, y: 0.75 }, // 그룹 C (좌하단)
    { x: 0.75, y: 0.72 }, // 그룹 D (우하단)
    { x: 0.50, y: 0.50 }, // 그룹 E (중앙)
  ];

  for (let g = 0; g < numGroups; g++) {
    const center = centers[g % centers.length];
    for (let i = 0; i < pointsPerGroup; i++) {
      let x = randomGaussian(center.x, 0.08);
      let y = randomGaussian(center.y, 0.08);
      // 0.05 ~ 0.95 범위로 클램핑
      x = Math.max(0.05, Math.min(0.95, x));
      y = Math.max(0.05, Math.min(0.95, y));

      points.push({
        id: `${g}-${i}-${Date.now()}-${Math.random()}`,
        x,
        y,
        groupId: g,
      });
    }
  }
  return points;
}

export default function KnnVisualizerPage() {
  const [numGroups, setNumGroups] = useState<number>(3);
  const [k, setK] = useState<number>(5);
  const [points, setPoints] = useState<Point[]>([]);
  const [testPoint, setTestPoint] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [clickMode, setClickMode] = useState<"test" | "add">("test");
  const [selectedAddGroup, setSelectedAddGroup] = useState<number>(0);
  const [showBoundary, setShowBoundary] = useState<boolean>(true);
  const [showRadius, setShowRadius] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // 초기 데이터셋 생성 및 그룹 수 변경 대응
  useEffect(() => {
    setPoints(generateDefaultDataset(numGroups));
  }, [numGroups]);

  // K 값 유효성 보정 (총 데이터 개수 초과 방지)
  const maxPossibleK = Math.max(1, points.length);
  const effectiveK = Math.min(k, maxPossibleK);

  // KNN 계산
  const { neighbors, votes, predictedGroup, maxDistance } = useMemo(() => {
    if (points.length === 0) {
      return {
        neighbors: [] as NeighborInfo[],
        votes: {} as Record<number, number>,
        predictedGroup: null as number | null,
        maxDistance: 0,
      };
    }

    // 모든 점과의 거리 계산 (유클리드 거리)
    const distances: NeighborInfo[] = points.map((p) => {
      const dx = p.x - testPoint.x;
      const dy = p.y - testPoint.y;
      return {
        point: p,
        distance: Math.sqrt(dx * dx + dy * dy),
      };
    });

    // 거리 오름차순 정렬
    distances.sort((a, b) => a.distance - b.distance);

    // K개의 최근접 이웃 선택
    const kNeighbors = distances.slice(0, effectiveK);

    // 투표 집계
    const voteCounts: Record<number, number> = {};
    for (let i = 0; i < numGroups; i++) {
      voteCounts[i] = 0;
    }

    kNeighbors.forEach((n) => {
      voteCounts[n.point.groupId] = (voteCounts[n.point.groupId] || 0) + 1;
    });

    // 다수결 결정 (동률 시 가장 가까운 점을 가진 그룹 우선)
    let bestGroup: number | null = null;
    let maxVotes = -1;

    for (let g = 0; g < numGroups; g++) {
      const count = voteCounts[g] || 0;
      if (count > maxVotes) {
        maxVotes = count;
        bestGroup = g;
      } else if (count === maxVotes && bestGroup !== null && count > 0) {
        // 동률 처리: kNeighbors 중 더 먼저(가까이) 등장한 그룹 우선
        const firstIdxA = kNeighbors.findIndex((n) => n.point.groupId === bestGroup);
        const firstIdxB = kNeighbors.findIndex((n) => n.point.groupId === g);
        if (firstIdxB !== -1 && (firstIdxA === -1 || firstIdxB < firstIdxA)) {
          bestGroup = g;
        }
      }
    }

    const maxDist = kNeighbors.length > 0 ? kNeighbors[kNeighbors.length - 1].distance : 0;

    return {
      neighbors: kNeighbors,
      votes: voteCounts,
      predictedGroup: bestGroup,
      maxDistance: maxDist,
    };
  }, [points, testPoint, effectiveK, numGroups]);

  // 캔버스 렌더링 함수
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. 결정 경계(Decision Boundary) 격자 렌더링
    if (showBoundary && points.length > 0) {
      const step = 8; // 그리드 해상도 (픽셀 단위)
      const cols = Math.ceil(width / step);
      const rows = Math.ceil(height / step);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sampleX = (c * step + step / 2) / width;
          const sampleY = (r * step + step / 2) / height;

          // 최근접 K개 이웃 계산
          const dists = points.map((p) => {
            const dx = p.x - sampleX;
            const dy = p.y - sampleY;
            return { g: p.groupId, d: dx * dx + dy * dy };
          });
          dists.sort((a, b) => a.d - b.d);
          const topK = dists.slice(0, effectiveK);

          const cellVotes: number[] = new Array(numGroups).fill(0);
          topK.forEach((item) => {
            if (item.g < numGroups) cellVotes[item.g]++;
          });

          let cellWinner = 0;
          let cellMaxVotes = -1;
          for (let g = 0; g < numGroups; g++) {
            if (cellVotes[g] > cellMaxVotes) {
              cellMaxVotes = cellVotes[g];
              cellWinner = g;
            }
          }

          const baseColor = GROUPS_CONFIG[cellWinner % GROUPS_CONFIG.length].color;
          // 반투명한 색상으로 셀 채우기
          ctx.fillStyle = `${baseColor}22`; // ~13% 불투명도
          ctx.fillRect(c * step, r * step, step, step);
        }
      }
    }

    // 2. 가이드 격자선 그리기
    ctx.strokeStyle = "rgba(150, 150, 150, 0.15)";
    ctx.lineWidth = 1;
    const gridDiv = 10;
    for (let i = 1; i < gridDiv; i++) {
      ctx.beginPath();
      ctx.moveTo((width / gridDiv) * i, 0);
      ctx.lineTo((width / gridDiv) * i, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, (height / gridDiv) * i);
      ctx.lineTo(width, (height / gridDiv) * i);
      ctx.stroke();
    }

    const testCanvasX = testPoint.x * width;
    const testCanvasY = testPoint.y * height;

    // 3. 최근접 이웃 반경 원 및 연결선
    if (neighbors.length > 0) {
      // K번째 이웃까지의 반경 원
      if (showRadius && maxDistance > 0) {
        const radiusPx = maxDistance * width;
        ctx.beginPath();
        ctx.arc(testCanvasX, testCanvasY, radiusPx, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(59, 130, 246, 0.04)";
        ctx.fill();
        ctx.setLineDash([]);
      }

      // K개 이웃과의 연결선 그리기
      neighbors.forEach((n) => {
        const px = n.point.x * width;
        const py = n.point.y * height;
        const pointColor = GROUPS_CONFIG[n.point.groupId % GROUPS_CONFIG.length].color;

        ctx.beginPath();
        ctx.moveTo(testCanvasX, testCanvasY);
        ctx.lineTo(px, py);
        ctx.strokeStyle = pointColor;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // 4. 학습 데이터 점 그리기
    points.forEach((p) => {
      const px = p.x * width;
      const py = p.y * height;
      const isNeighbor = neighbors.some((n) => n.point.id === p.id);
      const groupConfig = GROUPS_CONFIG[p.groupId % GROUPS_CONFIG.length];

      // 이웃 점일 경우 강조 링
      if (isNeighbor) {
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.strokeStyle = groupConfig.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.strokeStyle = `${groupConfig.color}44`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 기본 점
      ctx.beginPath();
      ctx.arc(px, py, isNeighbor ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fillStyle = groupConfig.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 5. 테스트 점 (Query Point) 그리기
    const predColor =
      predictedGroup !== null
        ? GROUPS_CONFIG[predictedGroup % GROUPS_CONFIG.length].color
        : "#000000";

    // 외곽 펄스 링
    ctx.beginPath();
    ctx.arc(testCanvasX, testCanvasY, 16, 0, Math.PI * 2);
    ctx.strokeStyle = `${predColor}55`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 메인 심볼 원
    ctx.beginPath();
    ctx.arc(testCanvasX, testCanvasY, 9, 0, Math.PI * 2);
    ctx.fillStyle = predColor;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 중앙 '+' 십자 표식
    ctx.beginPath();
    ctx.moveTo(testCanvasX - 4, testCanvasY);
    ctx.lineTo(testCanvasX + 4, testCanvasY);
    ctx.moveTo(testCanvasX, testCanvasY - 4);
    ctx.lineTo(testCanvasX, testCanvasY + 4);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [points, testPoint, neighbors, predictedGroup, maxDistance, showBoundary, showRadius, effectiveK, numGroups]);

  // 캔버스 다시 그리기 트리거
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // 마우스 좌표 변환 (0 ~ 1 정규화)
  const getNormalizedCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0.5, y: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getNormalizedCoords(e);
    if (clickMode === "test") {
      setTestPoint(coords);
      setIsDragging(true);
    } else {
      // 새 점 추가
      const newPoint: Point = {
        id: `custom-${Date.now()}-${Math.random()}`,
        x: coords.x,
        y: coords.y,
        groupId: selectedAddGroup,
      };
      setPoints((prev) => [...prev, newPoint]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && clickMode === "test") {
      const coords = getNormalizedCoords(e);
      setTestPoint(coords);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 데이터셋 초기화 / 리셋
  const handleRegenerate = () => {
    setPoints(generateDefaultDataset(numGroups));
  };

  const handleClearAll = () => {
    setPoints([]);
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col items-center py-8 px-4 sm:px-6 font-sans">
      <div className="w-full max-w-7xl space-y-6">
        {/* 상단 타이틀 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>KNN 알고리즘 시각화</span>
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                Interactive Studio
              </span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              K값과 그룹 수를 실시간으로 조절하며 K-최근접 이웃의 다수결 분류 원리를 관찰해 보세요.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              className="px-3.5 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              데이터 재배치
            </button>
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 text-sm font-medium bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 rounded-xl transition cursor-pointer"
            >
              전체 비우기
            </button>
          </div>
        </div>

        {/* 메인 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 좌측: 캔버스 시각화 영역 */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center p-3 sm:p-5">
              <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-2 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  {clickMode === "test"
                    ? "캔버스를 클릭하거나 드래그하여 테스트 점을 이동하세요."
                    : "캔버스를 클릭하여 선택한 그룹의 점을 추가하세요."}
                </span>
                <span>총 데이터: {points.length}개</span>
              </div>

              {/* 캔버스 요소 */}
              <div className="relative w-full aspect-square max-w-[620px] rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-900/90 shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={600}
                  className="w-full h-full cursor-crosshair block select-none touch-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>

              {/* 캔버스 하단 컨트롤 툴바 */}
              <div className="w-full mt-4 flex flex-wrap items-center justify-between gap-3 text-xs bg-zinc-900/70 p-3 rounded-xl border border-zinc-800">
                {/* 모드 선택 */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-semibold">마우스 모드:</span>
                  <div className="inline-flex rounded-lg bg-zinc-800 p-0.5 border border-zinc-700">
                    <button
                      onClick={() => setClickMode("test")}
                      className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                        clickMode === "test"
                          ? "bg-blue-600 text-white shadow"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      테스트 점 이동
                    </button>
                    <button
                      onClick={() => setClickMode("add")}
                      className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                        clickMode === "add"
                          ? "bg-blue-600 text-white shadow"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      새 점 추가
                    </button>
                  </div>
                </div>

                {/* 점 추가 모드일 때 추가할 그룹 선택 */}
                {clickMode === "add" && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">추가할 그룹:</span>
                    <div className="flex gap-1.5">
                      {GROUPS_CONFIG.slice(0, numGroups).map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setSelectedAddGroup(g.id)}
                          className={`w-6 h-6 rounded-full border-2 transition cursor-pointer flex items-center justify-center ${
                            selectedAddGroup === g.id
                              ? "border-white scale-110 shadow-md"
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: g.color }}
                          title={g.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 뷰 옵션 토글 */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showBoundary}
                      onChange={(e) => setShowBoundary(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-zinc-300">결정 경계(히트맵)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showRadius}
                      onChange={(e) => setShowRadius(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-zinc-300">K-반경 원</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 우측: 파라미터 조절 & 실시간 분류 결과 패널 */}
          <div className="lg:col-span-4 space-y-5">
            {/* 파라미터 조절 카드 */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-6">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                알고리즘 파라미터 설정
              </h2>

              {/* 1. 그룹 수 조절 */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-zinc-300">그룹 개수 (Classes)</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-blue-400 font-bold font-mono">
                    {numGroups}개
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map((count) => (
                    <button
                      key={count}
                      onClick={() => setNumGroups(count)}
                      className={`py-2 text-sm font-semibold rounded-xl border transition cursor-pointer ${
                        numGroups === count
                          ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {count}개
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. K 값 조절 */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-zinc-300">이웃 수 (K 값)</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-blue-400 font-bold font-mono">
                    K = {effectiveK}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.min(25, Math.max(1, points.length))}
                  step={1}
                  value={effectiveK}
                  onChange={(e) => setK(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                  <span>1 (과적합 위험)</span>
                  <span>{effectiveK % 2 === 1 ? "홀수 (동률 방지 권장)" : "짝수"}</span>
                  <span>최대 {Math.min(25, Math.max(1, points.length))}</span>
                </div>
              </div>

              {/* 그룹 안내 범례 */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <span className="text-xs font-semibold text-zinc-400">활성화된 그룹 범례</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {GROUPS_CONFIG.slice(0, numGroups).map((g) => {
                    const countInGroup = points.filter((p) => p.groupId === g.id).length;
                    return (
                      <div
                        key={g.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800"
                      >
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="font-medium text-zinc-200">{g.name}</span>
                        <span className="ml-auto text-[11px] text-zinc-500 font-mono">{countInGroup}점</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 실시간 예측 및 다수결 투표 결과 카드 */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                실시간 분류 예측 결과
              </h2>

              {predictedGroup !== null ? (
                <div className="space-y-4">
                  {/* 최종 예측 결과 배지 */}
                  <div
                    className="p-4 rounded-xl border flex items-center justify-between"
                    style={{
                      backgroundColor: `${GROUPS_CONFIG[predictedGroup].color}15`,
                      borderColor: `${GROUPS_CONFIG[predictedGroup].color}44`,
                    }}
                  >
                    <div>
                      <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block">
                        예측된 클래스
                      </span>
                      <span
                        className="text-2xl font-black mt-0.5 block"
                        style={{ color: GROUPS_CONFIG[predictedGroup].color }}
                      >
                        {GROUPS_CONFIG[predictedGroup].name}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-zinc-400 block">다수결 득표율</span>
                      <span className="text-xl font-bold font-mono text-zinc-100">
                        {votes[predictedGroup] || 0} / {effectiveK}표 (
                        {Math.round(((votes[predictedGroup] || 0) / effectiveK) * 100)}%)
                      </span>
                    </div>
                  </div>

                  {/* K개 이웃 그룹별 투표 현황 바 */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-zinc-400">
                      최근접 {effectiveK}개 이웃의 투표 분포
                    </span>
                    <div className="space-y-2">
                      {GROUPS_CONFIG.slice(0, numGroups).map((g) => {
                        const count = votes[g.id] || 0;
                        const percentage = effectiveK > 0 ? (count / effectiveK) * 100 : 0;
                        return (
                          <div key={g.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-300 font-medium">{g.name}</span>
                              <span className="text-zinc-400 font-mono">
                                {count}표 ({Math.round(percentage)}%)
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: g.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 최근접 이웃 리스트 */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                    <span className="text-xs font-semibold text-zinc-400">
                      가장 가까운 이웃 순위 (Top 5)
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                      {neighbors.slice(0, 5).map((n, idx) => {
                        const g = GROUPS_CONFIG[n.point.groupId % GROUPS_CONFIG.length];
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-zinc-500 w-4 font-semibold">
                                #{idx + 1}
                              </span>
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: g.color }}
                              />
                              <span className="text-zinc-200 font-medium">{g.name}</span>
                            </div>
                            <span className="font-mono text-zinc-400 text-[11px]">
                              거리: {(n.distance * 100).toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-zinc-500">
                  데이터 포인트가 없습니다. 상단의 [데이터 재배치]를 클릭하거나 점을 추가해 보세요.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
