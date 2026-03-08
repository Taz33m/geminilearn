import type { TutorSession } from "@/types/session";

export type DashboardNavigationIntent =
  | { type: "new" }
  | { type: "resume"; sessionId: string }
  | { type: "delete"; sessionId: string };

export interface SessionListItem {
  id: string;
  title: string;
  summary: string;
  status: TutorSession["status"];
  updatedAt: Date;
}

export interface DashboardSessionCard {
  id: string;
  title: string;
  status: TutorSession["status"];
  summary: string;
  artifactCount: number;
  eventCount: number;
  updatedAt: Date;
}

export interface DeterministicSummaryOutput {
  text: string;
  artifactCount: number;
  eventCount: number;
}
