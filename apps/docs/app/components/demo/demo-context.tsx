"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Definition of a demo step
 */
export interface DemoStep {
  id: string;
  label: string;
  description: string;
  /** More detailed explanation of what's happening in this step */
  details: string;
  /** Indices of the 2 panels that should be visible/focused */
  focusedPanels: [number, number];
  /** Optional: which panel index to highlight as "active" within the focused set */
  activePanel?: number;
  /** Optional: content overrides for specific panels at this step */
  panelOverrides?: Record<number, { code?: string; badge?: string }>;
}

interface DemoContextValue {
  /** Current step index */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Current step definition */
  step: DemoStep;
  /** All steps */
  steps: DemoStep[];
  /** Go to a specific step */
  goToStep: (index: number) => void;
  /** Go to next step */
  nextStep: () => void;
  /** Go to previous step */
  prevStep: () => void;
  /** Check if a panel index is currently visible */
  isPanelVisible: (panelIndex: number) => boolean;
  /** Check if a panel is the "active" one for this step */
  isPanelActive: (panelIndex: number) => boolean;
  /** Get panel position in the visible set (-1 if not visible) */
  getPanelPosition: (panelIndex: number) => number;
  /** Ref to the panels container for scrolling */
  panelsRef: RefObject<HTMLDivElement | null>;
}

const DemoContext = createContext<DemoContextValue | null>(null);

interface DemoProviderProps {
  children: ReactNode;
  steps: DemoStep[];
}

export function DemoProvider({ children, steps }: DemoProviderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const panelsRef = useRef<HTMLDivElement | null>(null);

  const step = steps[currentStep];
  const totalSteps = steps.length;

  // Scroll panels into view when step changes
  const scrollToPanel = useCallback(() => {
    if (panelsRef.current) {
      panelsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setCurrentStep(index);
        // Small delay to allow DOM to update before scrolling
        setTimeout(scrollToPanel, 50);
      }
    },
    [steps.length, scrollToPanel],
  );

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev < steps.length - 1 ? prev + 1 : prev;
      if (next !== prev) {
        setTimeout(scrollToPanel, 50);
      }
      return next;
    });
  }, [steps.length, scrollToPanel]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev > 0 ? prev - 1 : prev;
      if (next !== prev) {
        setTimeout(scrollToPanel, 50);
      }
      return next;
    });
  }, [scrollToPanel]);

  const isPanelVisible = useCallback(
    (panelIndex: number) => {
      return step.focusedPanels.includes(panelIndex);
    },
    [step.focusedPanels],
  );

  const isPanelActive = useCallback(
    (panelIndex: number) => {
      return step.activePanel === panelIndex;
    },
    [step.activePanel],
  );

  const getPanelPosition = useCallback(
    (panelIndex: number) => {
      return step.focusedPanels.indexOf(panelIndex);
    },
    [step.focusedPanels],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the event target is an interactive/editable element
      const target = e.target as HTMLElement;
      const isInteractiveElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.contentEditable === "true" ||
        target.hasAttribute("contenteditable") ||
        (target.hasAttribute("tabindex") && target.getAttribute("tabindex") !== "-1");

      // Check if the demo area (panels container) is focused or contains the active element
      const demoAreaFocused =
        panelsRef.current &&
        (panelsRef.current.contains(document.activeElement) ||
          panelsRef.current === document.activeElement);

      // Early return if target is interactive and demo area is not focused
      if (isInteractiveElement && !demoAreaFocused) {
        return;
      }

      // Only handle arrow keys when demo area is focused or target is not interactive
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextStep, prevStep]);

  return (
    <DemoContext.Provider
      value={{
        currentStep,
        totalSteps,
        step,
        steps,
        goToStep,
        nextStep,
        prevStep,
        isPanelVisible,
        isPanelActive,
        getPanelPosition,
        panelsRef,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}
