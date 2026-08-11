import type {
  ExamAntiCheatState,
  ExamSuspiciousEvent,
} from "@/features/exam/types";

import {
  asRecord,
  normalizeSuspiciousEvents,
  safeNumber,
} from "@/features/exam/utils";

export type MergeAntiCheatInput = {
  savedAntiCheat: unknown;
  requestAntiCheat: unknown;
};

export type ResolvedAntiCheatState = {
  visibilityLostCount: number;
  focusLostCount: number;
  suspiciousEventCount: number;
  suspiciousEvents: ExamSuspiciousEvent[];
  hasSuspiciousActivity: boolean;
};

function normalizeCounter(
  value: unknown
): number {
  return Math.max(
    0,
    Math.floor(
      safeNumber(value, 0)
    )
  );
}

export function mergeSuspiciousEvents(
  first: ExamSuspiciousEvent[],
  second: ExamSuspiciousEvent[],
  maximumEvents = 100
): ExamSuspiciousEvent[] {
  const eventMap = new Map<
    string,
    ExamSuspiciousEvent
  >();

  [...first, ...second].forEach(
    (event) => {
      const key =
        `${event.type}|${event.at}`;

      eventMap.set(key, event);
    }
  );

  const safeMaximumEvents = Math.max(
    1,
    Math.floor(maximumEvents)
  );

  return Array.from(
    eventMap.values()
  )
    .sort((a, b) =>
      a.at.localeCompare(b.at)
    )
    .slice(-safeMaximumEvents);
}

function collapseNearDuplicateLeaveEvents(
  events: ExamSuspiciousEvent[],
  thresholdMs = 1500
): ExamSuspiciousEvent[] {
  const sortedEvents = [...events].sort((a, b) =>
    a.at.localeCompare(b.at)
  );
  const collapsedEvents: ExamSuspiciousEvent[] = [];

  for (const event of sortedEvents) {
    const lastEvent = collapsedEvents[collapsedEvents.length - 1];

    if (
      lastEvent &&
      ((lastEvent.type === "visibility_hidden" &&
        event.type === "window_blur") ||
        (lastEvent.type === "window_blur" &&
          event.type === "visibility_hidden"))
    ) {
      const lastTime = new Date(lastEvent.at).getTime();
      const currentTime = new Date(event.at).getTime();

      if (
        Number.isFinite(lastTime) &&
        Number.isFinite(currentTime) &&
        Math.abs(currentTime - lastTime) <= thresholdMs
      ) {
        if (event.type === "visibility_hidden") {
          collapsedEvents[collapsedEvents.length - 1] = event;
        }

        continue;
      }
    }

    collapsedEvents.push(event);
  }

  return collapsedEvents.slice(-100);
}

export function resolveAntiCheatState({
  savedAntiCheat,
  requestAntiCheat,
}: MergeAntiCheatInput): ResolvedAntiCheatState {
  const saved = asRecord(
    savedAntiCheat
  );

  const requested = asRecord(
    requestAntiCheat
  );

  const visibilityLostCount =
    Math.max(
      normalizeCounter(
        saved.visibilityLostCount
      ),
      normalizeCounter(
        requested.visibilityLostCount
      )
    );

  const focusLostCount =
    Math.max(
      normalizeCounter(
        saved.focusLostCount
      ),
      normalizeCounter(
        requested.focusLostCount
      )
    );

  const suspiciousEvents =
    collapseNearDuplicateLeaveEvents(
      mergeSuspiciousEvents(
      normalizeSuspiciousEvents(
        saved.suspiciousEvents
      ),
      normalizeSuspiciousEvents(
        requested.suspiciousEvents
      )
      )
    ).filter(
      (event) =>
        event.type ===
        "visibility_hidden"
    );

  const suspiciousEventCount =
    suspiciousEvents.length;

  const hasSuspiciousActivity =
    visibilityLostCount > 0 ||
    suspiciousEventCount > 0;

  return {
    visibilityLostCount,
    focusLostCount,
    suspiciousEventCount,
    suspiciousEvents,
    hasSuspiciousActivity,
  };
}

export function normalizeAntiCheatState(
  value: unknown
): ExamAntiCheatState {
  const antiCheat = asRecord(value);

  return {
    visibilityLostCount:
      normalizeCounter(
        antiCheat.visibilityLostCount
      ),

    focusLostCount:
      normalizeCounter(
        antiCheat.focusLostCount
      ),

    suspiciousEvents:
      normalizeSuspiciousEvents(
        antiCheat.suspiciousEvents
      ),
  };
}

export function hasAntiCheatActivity(
  value: unknown
): boolean {
  const antiCheat =
    normalizeAntiCheatState(value);

  return (
    antiCheat.visibilityLostCount > 0 ||
    antiCheat.suspiciousEvents.some(
      (event) =>
        event.type ===
        "visibility_hidden"
    )
  );
}
