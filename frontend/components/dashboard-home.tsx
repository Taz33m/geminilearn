'use client';

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { PrimaryAction } from "@/components/ui/primary-action";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  createTutorSession,
  ensureSessionSummaries,
  getLocalSessionRepository,
} from "@/lib/session-repository";
import { buildSessionSummary, createEventId } from "@/lib/session-storage";
import type { DashboardNavigationIntent } from "@/types/session-app";
import type { TutorSession } from "@/types/session";
import logoImage from "@/logo.png";

const formatTimestamp = (date: Date) =>
  date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function DashboardHome() {
  const router = useRouter();
  const repository = useMemo(() => getLocalSessionRepository(), []);

  const [sessions, setSessions] = useState<TutorSession[]>([]);

  useEffect(() => {
    setSessions(ensureSessionSummaries(repository.list()));
  }, [repository]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [sessions],
  );

  const recentArtifacts = useMemo(
    () =>
      sessions
        .flatMap((session) =>
          session.artifacts.map((artifact) => ({
            ...artifact,
            sessionTitle: session.title,
          })),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10),
    [sessions],
  );

  const persistAndSet = (next: TutorSession[]) => {
    const normalized = ensureSessionSummaries(next);
    setSessions(normalized);
    repository.saveAll(normalized);
  };

  const handleIntent = (intent: DashboardNavigationIntent) => {
    if (intent.type === "new") {
      const now = new Date();
      const endedExisting = sessions.map((session) => {
        if (session.status !== "active") return session;

        const endedSession: TutorSession = {
          ...session,
          status: "ended",
          endedAt: now,
          updatedAt: now,
          events: [
            ...session.events,
            {
              id: createEventId(),
              type: "session_ended",
              timestamp: now,
              text: "Session automatically ended when a new session started.",
            },
          ],
        };

        return {
          ...endedSession,
          summary: buildSessionSummary(endedSession),
        };
      });

      const created = createTutorSession(endedExisting);
      const next = [created, ...endedExisting].slice(0, 30);
      persistAndSet(next);
      router.push(`/sessions/${created.id}`);
      return;
    }

    if (intent.type === "resume") {
      router.push(`/sessions/${intent.sessionId}`);
      return;
    }

    const next = sessions.filter((session) => session.id !== intent.sessionId);
    persistAndSet(next);
  };

  return (
    <div className="h-screen w-full overflow-y-auto bg-white p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={logoImage}
              alt="Geminilearn"
              width={36}
              height={36}
              className="rounded-lg border border-slate-200"
            />
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Tutor Sessions</h1>
              <p className="mt-1 text-sm text-slate-500">Create, resume, and manage sessions.</p>
            </div>
          </div>
          <PrimaryAction type="button" onClick={() => handleIntent({ type: "new" })}>
            New Session
          </PrimaryAction>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(88px,0.45fr)_92px_92px_96px] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Session</span>
            <span className="text-center">Status</span>
            <span className="text-center">Artifacts</span>
            <span className="text-center">Events</span>
            <span className="text-center">Actions</span>
          </div>

          {sortedSessions.length ? (
            <div className="divide-y divide-slate-200 bg-white">
              {sortedSessions.map((session) => (
                <div
                  key={session.id}
                  className="grid grid-cols-[minmax(0,1.35fr)_minmax(88px,0.45fr)_92px_92px_96px] gap-2 px-4 py-3 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => handleIntent({ type: "resume", sessionId: session.id })}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate font-medium text-slate-900">{session.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{session.summary}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatTimestamp(session.updatedAt)}</p>
                  </button>

                  <div className="flex items-center justify-center">
                    <StatusBadge status={session.status} />
                  </div>

                  <div className="flex items-center justify-center text-slate-700">
                    {session.artifacts.length}
                  </div>
                  <div className="flex items-center justify-center text-slate-700">
                    {session.events.length}
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleIntent({ type: "resume", sessionId: session.id })}
                      aria-label={`Open ${session.title}`}
                      title="Open session"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                        <path
                          d="M7 4l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIntent({ type: "delete", sessionId: session.id })}
                      aria-label={`Delete ${session.title}`}
                      title="Delete session"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                        <path
                          d="M4 6h12M8 6V4h4v2m-5 0v10h6V6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No sessions yet"
                description="Start your first tutor session."
                action={
                  <PrimaryAction type="button" onClick={() => handleIntent({ type: "new" })}>
                    Start Session
                  </PrimaryAction>
                }
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Recent Artifacts</p>
          </div>
          {recentArtifacts.length ? (
            <div className="divide-y divide-slate-100">
              {recentArtifacts.map((artifact) => (
                <div key={artifact.id} className="px-4 py-3">
                  <p className="truncate text-sm font-medium text-slate-900">{artifact.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{artifact.sessionTitle}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatTimestamp(artifact.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">No artifacts yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
