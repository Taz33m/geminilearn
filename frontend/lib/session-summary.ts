import type { TutorSession } from "@/types/session";
import type { DeterministicSummaryOutput } from "@/types/session-app";

export const generateDeterministicSummary = (
  session: TutorSession,
): DeterministicSummaryOutput => {
  const flashcardDecks = session.artifacts.filter(
    (artifact) => artifact.type === "flashcard_deck",
  ).length;
  const visualizations = session.artifacts.filter(
    (artifact) => artifact.type === "visualization_image",
  ).length;
  const deepDives = session.artifacts.filter(
    (artifact) => artifact.type === "deep_dive_bundle",
  ).length;
  const docs = session.artifacts.filter(
    (artifact) => artifact.type === "google_doc",
  ).length;
  const sheets = session.artifacts.filter(
    (artifact) => artifact.type === "google_sheet",
  ).length;

  const parts: string[] = [];
  if (flashcardDecks > 0) {
    parts.push(`${flashcardDecks} flashcard deck${flashcardDecks === 1 ? "" : "s"}`);
  }
  if (visualizations > 0) {
    parts.push(`${visualizations} visualization${visualizations === 1 ? "" : "s"}`);
  }
  if (deepDives > 0) {
    parts.push(`${deepDives} deep dive${deepDives === 1 ? "" : "s"}`);
  }
  if (docs > 0) {
    parts.push(`${docs} google doc${docs === 1 ? "" : "s"}`);
  }
  if (sheets > 0) {
    parts.push(`${sheets} google sheet${sheets === 1 ? "" : "s"}`);
  }

  const text =
    parts.length === 0
      ? "Session started; no artifacts generated yet."
      : `Session produced ${parts.join(", ")}.`;

  return {
    text,
    artifactCount: session.artifacts.length,
    eventCount: session.events.length,
  };
};
