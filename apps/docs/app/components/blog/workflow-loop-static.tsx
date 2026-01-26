/**
 * WorkflowLoopStatic - A static version of the workflow loop for blog posts.
 *
 * Displays the hexagonal workflow diagram without interactivity.
 */

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
}: {
  node: WorkflowNode;
  position: { x: number; y: number };
}) {
  const outerSize = 70;
  const innerSize = 60;
  const outerPoints = `0,-${outerSize} ${outerSize * 0.866},-${outerSize * 0.5} ${outerSize * 0.866},${outerSize * 0.5} 0,${outerSize} -${outerSize * 0.866},${outerSize * 0.5} -${outerSize * 0.866},-${outerSize * 0.5}`;
  const innerPoints = `0,-${innerSize} ${innerSize * 0.866},-${innerSize * 0.5} ${innerSize * 0.866},${innerSize * 0.5} 0,${innerSize} -${innerSize * 0.866},${innerSize * 0.5} -${innerSize * 0.866},-${innerSize * 0.5}`;

  return (
    <g transform={`translate(${position.x}, ${position.y})`} className="select-none">
      {/* Outer hexagon border */}
      <polygon points={outerPoints} className="fill-card stroke-border stroke-[1.5px]" />

      {/* Inner hexagon */}
      <polygon points={innerPoints} className="fill-background/80 dark:fill-background/90" />

      {/* Image container */}
      <defs>
        <clipPath id={`hex-clip-static-${node.id}`}>
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
        clipPath={`url(#hex-clip-static-${node.id})`}
        className="pointer-events-none dark:opacity-70"
      />

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
  index,
  centerX,
  centerY,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  index: number;
  centerX: number;
  centerY: number;
}) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  const offsetX = (midX - centerX) * 0.3;
  const offsetY = (midY - centerY) * 0.3;
  const controlX = midX + offsetX;
  const controlY = midY + offsetY;

  const pathId = `flow-path-static-${index}`;

  return (
    <g>
      {/* Main connector path */}
      <path
        id={pathId}
        d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-border"
      />

      {/* Arrow head at destination */}
      <circle cx={to.x} cy={to.y} r="5" className="fill-muted-foreground/50" />
    </g>
  );
}

export function WorkflowLoopStatic() {
  const centerX = 300;
  const centerY = 280;
  const radius = 190;

  const positions = nodes.map((_, i) => {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  const getEdgePoint = (nodeIndex: number, direction: "out" | "in") => {
    const nodePos = positions[nodeIndex]!;
    const nextIndex = (nodeIndex + 1) % 6;
    const prevIndex = (nodeIndex - 1 + 6) % 6;
    const edgeOffset = 70;

    if (direction === "out") {
      const nextPos = positions[nextIndex]!;
      const angle = Math.atan2(nextPos.y - nodePos.y, nextPos.x - nodePos.x);
      return {
        x: nodePos.x + edgeOffset * Math.cos(angle),
        y: nodePos.y + edgeOffset * Math.sin(angle),
      };
    } else {
      const prevPos = positions[prevIndex]!;
      const angle = Math.atan2(nodePos.y - prevPos.y, nodePos.x - prevPos.x);
      return {
        x: nodePos.x - edgeOffset * Math.cos(angle),
        y: nodePos.y - edgeOffset * Math.sin(angle),
      };
    }
  };

  return (
    <div className="not-prose">
      <div className="relative mx-auto aspect-square max-w-[600px]">
        <svg viewBox="0 0 600 560" className="h-full w-full">
          {/* Flow connectors */}
          {nodes.map((_, i) => {
            const fromEdge = getEdgePoint(i, "out");
            const toEdge = getEdgePoint((i + 1) % 6, "in");

            return (
              <FlowConnector
                key={`connector-${i}`}
                from={fromEdge}
                to={toEdge}
                index={i}
                centerX={centerX}
                centerY={centerY}
              />
            );
          })}

          {/* Hexagonal nodes */}
          {nodes.map((node, i) => (
            <HexagonalNode key={node.id} node={node} position={positions[i]!} />
          ))}
        </svg>
      </div>
    </div>
  );
}
