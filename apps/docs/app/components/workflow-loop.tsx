import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WorkflowNode {
  id: number;
  title: string;
  caption: string;
  subtext: string;
  image: string;
}

const nodes: WorkflowNode[] = [
  {
    id: 1,
    title: "Unstructured Information",
    caption: "Capture Chaos",
    subtext: "Dump thoughts rapidly. Text or speech.",
    image: "/workflow-1.webp",
  },
  {
    id: 2,
    title: "Extracting to Entries",
    caption: "LLMs Structure",
    subtext: "LLMs extract raw text into your defined entities.",
    image: "/workflow-2.webp",
  },
  {
    id: 3,
    title: "Synthesising Information",
    caption: "Synthesize",
    subtext: "Run queries over your graph to generate summaries or new entries.",
    image: "/workflow-3.webp",
  },
  {
    id: 4,
    title: "Asking Questions",
    caption: "Identify Gaps",
    subtext: "Use your favorite AI tool to spot missing links and generates questions.",
    image: "/workflow-4.webp",
  },
  {
    id: 5,
    title: "Agentic Search",
    caption: "Active Exploration",
    subtext: "Seek external resources or answer questions.",
    image: "/workflow-5.webp",
  },
  {
    id: 6,
    title: "New Insights",
    caption: "Evolve Thinking",
    subtext: "Answering generates new insights, restarting the cycle.",
    image: "/workflow-6.webp",
  },
];

function HexagonalNode({
  node,
  position,
  isActive,
  onClick,
}: {
  node: WorkflowNode;
  position: { x: number; y: number };
  isActive: boolean;
  onClick: () => void;
}) {
  // Larger hexagon dimensions
  const outerSize = 70;
  const innerSize = 60;
  const outerPoints = `0,-${outerSize} ${outerSize * 0.866},-${outerSize * 0.5} ${outerSize * 0.866},${outerSize * 0.5} 0,${outerSize} -${outerSize * 0.866},${outerSize * 0.5} -${outerSize * 0.866},-${outerSize * 0.5}`;
  const innerPoints = `0,-${innerSize} ${innerSize * 0.866},-${innerSize * 0.5} ${innerSize * 0.866},${innerSize * 0.5} 0,${innerSize} -${innerSize * 0.866},${innerSize * 0.5} -${innerSize * 0.866},-${innerSize * 0.5}`;

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      onClick={onClick}
      className="cursor-pointer select-none outline-none focus:outline-none"
      style={{ outline: "none" }}
      role="button"
      tabIndex={-1}
    >
      {/* Glow effect when active */}
      {isActive && <circle r="78" className="fill-primary/10 dark:fill-primary/15 animate-pulse" />}

      {/* Outer hexagon border */}
      <polygon
        points={outerPoints}
        className={`
          fill-card dark:fill-card
          transition-all duration-300
          ${isActive ? "stroke-primary stroke-[2.5px]" : "stroke-border stroke-[1.5px]"}
        `}
      />

      {/* Inner hexagon with gradient */}
      <polygon
        points={innerPoints}
        className={`
          transition-all duration-300
          ${
            isActive ? "fill-accent/50 dark:fill-accent/30" : "fill-background/80 dark:fill-card/80"
          }
        `}
      />

      {/* Image container - using clipPath for cross-browser support */}
      <defs>
        <clipPath id={`hex-clip-${node.id}`}>
          <polygon points={innerPoints} />
        </clipPath>
      </defs>
      <image
        href={node.image}
        x="-50"
        y="-55"
        width="100"
        height="100"
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#hex-clip-${node.id})`}
        className="pointer-events-none"
      />

      {/* Node number */}
      <text y="28" textAnchor="middle" className="fill-muted-foreground text-[12px] font-mono">
        0{node.id}
      </text>

      {/* Caption below hexagon */}
      <text y="92" textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
        {node.caption}
      </text>
    </g>
  );
}

function FlowConnector({
  from,
  to,
  isActive,
  index,
  centerX,
  centerY,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  isActive: boolean;
  index: number;
  centerX: number;
  centerY: number;
}) {
  // Calculate control points for curved path
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Offset the control point slightly outward from center for a nice curve
  const offsetX = (midX - centerX) * 0.3;
  const offsetY = (midY - centerY) * 0.3;
  const controlX = midX + offsetX;
  const controlY = midY + offsetY;

  const pathId = `flow-path-${index}`;

  return (
    <g>
      {/* Glow layer */}
      <path
        d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`}
        fill="none"
        strokeWidth="10"
        className={`
          transition-all duration-500
          ${isActive ? "stroke-primary/20 dark:stroke-primary/15" : "stroke-transparent"}
        `}
      />

      {/* Main connector path */}
      <path
        id={pathId}
        d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={`
          transition-all duration-300
          ${isActive ? "stroke-primary dark:stroke-primary" : "stroke-border dark:stroke-border"}
        `}
      />

      {/* Animated flow particle - slower animation to match stage duration */}
      {isActive && (
        <circle r="4" className="fill-primary dark:fill-primary">
          <animateMotion dur="2800ms" repeatCount="indefinite">
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      )}

      {/* Arrow head at destination */}
      <circle
        cx={to.x}
        cy={to.y}
        r="5"
        className={`
          transition-all duration-300
          ${
            isActive
              ? "fill-primary dark:fill-primary"
              : "fill-muted-foreground/50 dark:fill-muted-foreground/30"
          }
        `}
      />
    </g>
  );
}

export function WorkflowLoop() {
  const [activeNode, setActiveNode] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hexagon positions (centered around 300, 280) - larger layout
  const centerX = 300;
  const centerY = 280;
  const radius = 190;

  const positions = nodes.map((_, i) => {
    // Start from top (-90 degrees) and go clockwise
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  // Connector edge points (on hexagon edges) - larger offset for bigger nodes
  const getEdgePoint = (nodeIndex: number, direction: "out" | "in") => {
    const nodePos = positions[nodeIndex]!;
    const nextIndex = (nodeIndex + 1) % 6;
    const prevIndex = (nodeIndex - 1 + 6) % 6;
    const edgeOffset = 70; // Larger offset for bigger hexagons

    if (direction === "out") {
      // Point towards next node
      const nextPos = positions[nextIndex]!;
      const angle = Math.atan2(nextPos.y - nodePos.y, nextPos.x - nodePos.x);
      return {
        x: nodePos.x + edgeOffset * Math.cos(angle),
        y: nodePos.y + edgeOffset * Math.sin(angle),
      };
    } else {
      // Point from previous node
      const prevPos = positions[prevIndex]!;
      const angle = Math.atan2(nodePos.y - prevPos.y, nodePos.x - prevPos.x);
      return {
        x: nodePos.x - edgeOffset * Math.cos(angle),
        y: nodePos.y - edgeOffset * Math.sin(angle),
      };
    }
  };

  const goToNext = useCallback(() => {
    setActiveNode((prev) => (prev + 1) % 6);
    setIsAutoPlaying(false);
  }, []);

  const goToPrev = useCallback(() => {
    setActiveNode((prev) => (prev - 1 + 6) % 6);
    setIsAutoPlaying(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsAutoPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev]);

  // Auto-advance through nodes
  useEffect(() => {
    if (!isAutoPlaying) {
      return;
    }

    const interval = setInterval(() => {
      setActiveNode((prev) => (prev + 1) % 6);
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleNodeClick = (index: number) => {
    setActiveNode(index);
    setIsAutoPlaying(false);
  };

  const activeNodeData = nodes[activeNode]!;

  return (
    <section className="relative w-full overflow-hidden py-24 md:py-32">
      {/* Subtle paper texture hint - matching the site */}
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjAzIi8+PC9zdmc+')] opacity-50 dark:opacity-30" />

      {/* Subtle gradient orbs - warm tones */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 size-[500px] translate-x-1/2 translate-y-1/2 rounded-full bg-amber-500/5 blur-3xl dark:bg-amber-400/5" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-8" ref={containerRef}>
        {/* Section header */}
        <div className="mb-12 md:mb-16">
          <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
            — THE STRUCTURED ENGINE
          </span>
          <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
            A continuous loop of{" "}
            <span className="relative">
              <span className="italic text-primary">knowledge refinement</span>
              <svg
                className="absolute -bottom-1 left-0 h-2 w-full text-primary/30 overflow-visible"
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 7 Q 25 0, 50 7 T 100 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Thalo transforms chaotic information into usable data through a feedback loop designed
            for AI collaboration.
          </p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-5 lg:gap-12">
          {/* Hexagonal diagram - takes 3 columns */}
          <div className="lg:col-span-3">
            <div className="relative mx-auto aspect-square max-w-[600px]">
              <svg viewBox="0 0 600 560" className="h-full w-full">
                <defs>
                  {/* Gradient for glow effects */}
                  <radialGradient id="glow-gradient">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Flow connectors (draw first so nodes appear on top) */}
                {nodes.map((_, i) => {
                  const fromEdge = getEdgePoint(i, "out");
                  const toEdge = getEdgePoint((i + 1) % 6, "in");
                  const isActive = i === activeNode;

                  return (
                    <FlowConnector
                      key={`connector-${i}`}
                      from={fromEdge}
                      to={toEdge}
                      isActive={isActive}
                      index={i}
                      centerX={centerX}
                      centerY={centerY}
                    />
                  );
                })}

                {/* Hexagonal nodes */}
                {nodes.map((node, i) => (
                  <HexagonalNode
                    key={node.id}
                    node={node}
                    position={positions[i]!}
                    isActive={i === activeNode}
                    onClick={() => handleNodeClick(i)}
                  />
                ))}

                {/* Center decoration */}
                {/* <g transform={`translate(${centerX}, ${centerY})`}>
                  <circle r="32" className="fill-card stroke-border" strokeWidth="2" />
                  <text textAnchor="middle" y="5" className="fill-primary text-[12px] font-mono font-bold">
                    THALO
                  </text>
                </g> */}
              </svg>
            </div>
          </div>

          {/* Info panel - takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-xl shadow-primary/5">
              {/* Decorative gradient accent */}
              <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent" />

              {/* Header with navigation */}
              <div className="relative -mx-6 -mt-6 mb-6 flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-400/80" />
                    <span className="size-2.5 rounded-full bg-yellow-400/80" />
                    <span className="size-2.5 rounded-full bg-green-400/80" />
                  </div>
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    workflow.engine
                  </span>
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={goToPrev}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                    aria-label="Previous step"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                    aria-label="Next step"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>

              {/* Active node indicator */}
              <div className="relative mb-4 flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="font-mono text-xl font-bold">0{activeNode + 1}</span>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Current Stage
                  </p>
                  <p className="font-semibold text-foreground">{activeNodeData.title}</p>
                </div>
              </div>

              {/* Caption */}
              <h3 className="relative mb-2 text-2xl font-bold tracking-tight text-foreground">
                {activeNodeData.caption}
              </h3>

              {/* Subtext */}
              <p className="relative mb-6 leading-relaxed text-muted-foreground">
                {activeNodeData.subtext}
              </p>

              {/* Progress indicator */}
              <div className="relative flex gap-1.5">
                {nodes.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleNodeClick(i)}
                    className={`
                      h-2 flex-1 rounded-full transition-all duration-300
                      ${i === activeNode ? "bg-primary" : "bg-border hover:bg-primary/30"}
                    `}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>

              {/* Auto-play toggle and keyboard hint */}
              <div className="relative mt-4 flex items-center justify-between">
                <button
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span
                    className={`size-2 rounded-full ${isAutoPlaying ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"}`}
                  />
                  {isAutoPlaying ? "Auto-playing" : "Paused"}
                </button>
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  ← → to navigate
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
