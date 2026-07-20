import { describe, expect, it, vi } from "vitest";
import { DemoClient } from "../src/lib/demo/DemoClient";
import { onDemoNotice } from "../src/lib/demo/notice";
import { buildDemoData } from "../src/lib/demo/seed";

describe("demo mode (R9/D2)", () => {
  it("seed is deterministic and carries the day-loop story", () => {
    const today = new Date(2026, 6, 15);
    const a = buildDemoData(today);
    const b = buildDemoData(today);
    expect(a.tasks.map((t) => t.title)).toEqual(b.tasks.map((t) => t.title));
    const statuses = new Set(a.tasks.filter((t) => t.date === "2026-07-15").map((t) => t.status));
    for (const s of ["planned", "running", "waiting", "ready", "done"]) expect(statuses.has(s as never)).toBe(true);
    expect(a.sessions.some((s) => s.suggestions.some((x) => x.state === "pending"))).toBe(true);
    expect(a.evidence.some((e) => e.kind === "friction")).toBe(true);
    expect(a.evidence.some((e) => e.kind === "lesson")).toBe(true);
  });

  /* the demo-deploy handoff's seed invariants (§6.2) */
  it("seed satisfies the deployed-demo inventory", async () => {
    const data = buildDemoData(new Date(2026, 6, 15));
    /* every status present somewhere; volume in the ~50-60 band */
    const statuses = new Set(data.tasks.map((t) => t.status));
    for (const s of ["planned", "running", "waiting", "ready", "done", "shelved"]) expect(statuses.has(s as never)).toBe(true);
    expect(data.tasks.length).toBeGreaterThanOrEqual(45);
    expect(data.tasks.length).toBeLessThanOrEqual(70);
    /* distinct statusAt across Ready tasks — Inbox orders oldest-first on it */
    const readyAt = data.tasks.filter((t) => t.status === "ready").map((t) => t.statusAt);
    expect(readyAt.length).toBeGreaterThanOrEqual(2);
    expect(new Set(readyAt).size).toBe(readyAt.length);
    /* three projects, one folderless (D18) */
    expect(data.projects.length).toBe(3);
    expect(data.projects.filter((p) => !p.dir).length).toBe(1);
    /* two L1s, three-to-four L2s */
    expect(data.objectives.filter((o) => o.level === 1).length).toBe(2);
    const l2 = data.objectives.filter((o) => o.level === 2).length;
    expect(l2).toBeGreaterThanOrEqual(3);
    expect(l2).toBeLessThanOrEqual(4);
    /* recon records cover the heat window */
    expect(data.recons.length).toBeGreaterThanOrEqual(12);

    const client = new DemoClient(null);
    const inbox = await client.inbox();
    /* 2-3 sign-off heroes, each with artifacts; mixed tile kinds incl. a PR */
    expect(inbox.signoff.length).toBeGreaterThanOrEqual(2);
    expect(inbox.signoff.length).toBeLessThanOrEqual(3);
    for (const card of inbox.signoff) expect(card.artifacts.length).toBeGreaterThan(0);
    const kinds = new Set(inbox.signoff.flatMap((c) => c.artifacts.map((a) => a.kind)));
    expect(kinds.has("file")).toBe(true);
    expect(kinds.has("pr")).toBe(true);
    /* never a previewless file artifact on an Inbox hero card */
    for (const card of inbox.signoff) {
      for (const artifact of card.artifacts.filter((a) => a.kind === "file")) {
        expect(await client.artifactPreview(artifact)).not.toBeNull();
      }
    }
    /* waiting cards carry real messages; at least one exercises inline
       markdown near the 500-char clamp (D19.6) */
    expect(inbox.waiting.length).toBeGreaterThanOrEqual(1);
    for (const card of inbox.waiting) expect((card.lastMessage ?? "").length).toBeGreaterThan(0);
    const md = inbox.waiting.map((c) => c.lastMessage ?? "");
    expect(md.some((m) => /\*\*.+\*\*/.test(m) && /`.+`/.test(m))).toBe(true);
    expect(md.some((m) => m.length > 400 && m.length <= 500)).toBe(true);
  });

  it("client serves the same contract shapes without a sidecar", async () => {
    const client = new DemoClient(null);
    const boot = await client.bootstrap();
    expect(boot.tasks.length).toBeGreaterThan(20);
    const ready = boot.tasks.find((t) => t.status === "ready")!;
    const detail = await client.taskDetail(ready.id);
    expect(detail.artifacts.length).toBeGreaterThan(0);
    expect(boot.projects.length).toBeGreaterThanOrEqual(3);
    /* D18: one folderless project sits beside the connected repos */
    expect(boot.projects.some((p) => !p.dir)).toBe(true);
    const inbox = await client.inbox();
    expect(inbox.signoff.length).toBeGreaterThan(0);
    expect(inbox.waiting[0]?.lastMessage).toContain("Which trade should I take?");
    const progress = await client.progress();
    expect(Object.keys(progress.days).length).toBeGreaterThan(12);
    /* the seeded grid carries ready signal, not just done (r1B) */
    expect(Object.values(progress.days).some((d) => d.ready.length > 0)).toBe(true);
  });

  it("updateTask records the edit in the activity trail", async () => {
    const client = new DemoClient(null);
    const boot = await client.bootstrap();
    const task = boot.tasks[0];
    await client.updateTask(task.id, { description: "sharper" });
    await client.updateTask(task.id, { description: "sharper" });
    const detail = await client.taskDetail(task.id);
    const edits = detail.activity.filter((a) => a.kind === "updated");
    expect(edits.map((e) => e.note)).toEqual(["description"]);
  });

  it("gated opens emit a demo notice; reset restores the story (story 12)", async () => {
    const client = new DemoClient(null);
    const notices: string[] = [];
    const off = onDemoNotice((text) => notices.push(text));
    try {
      await client.openArtifact({ kind: "session", label: "s", sessionId: "s-x", at: "" });
      await client.openArtifact({ kind: "file", label: "notes.md", path: "~/repos/x/notes.md", sessionId: "s-x", at: "" });
      await client.openArtifact({ kind: "file", label: "chart.svg", path: "~/repos/x/chart.svg", sessionId: "s-x", at: "" });
      expect(notices[0]).toContain("terminal");
      expect(notices[1]).toContain("editor");
      expect(notices[2]).toContain("viewer");
      /* the folderless refusal reaches the toast with the live message */
      const boot = await client.bootstrap();
      const folderless = boot.projects.find((p) => !p.dir)!;
      const task = boot.tasks.find((t) => t.projectId === folderless.id && t.status === "planned")!;
      await expect(client.dispatch(task.id)).rejects.toThrow();
      expect(notices[3]).toBe("Set a project with a directory, then dispatch");
    } finally {
      off();
    }
    /* reset: mutate the story, then restore it byte-identical */
    const before = JSON.stringify(await client.bootstrap());
    const planned = (await client.bootstrap()).tasks.find((t) => t.status === "planned")!;
    await client.moveStatus(planned.id, "shelved");
    expect(JSON.stringify(await client.bootstrap())).not.toBe(before);
    await client.resetDemo();
    const after = await client.bootstrap();
    expect(after.tasks.map((t) => t.title)).toEqual(JSON.parse(before).tasks.map((t: { title: string }) => t.title));
    expect(after.tasks.find((t) => t.id === planned.id)?.status).toBe("planned");
  });

  it("dispatch refuses a folderless project with the live message (D2)", async () => {
    const client = new DemoClient(null);
    const boot = await client.bootstrap();
    const folderless = boot.projects.find((p) => !p.dir)!;
    const task = boot.tasks.find((t) => t.projectId === folderless.id && t.status === "planned")!;
    await expect(client.dispatch(task.id)).rejects.toThrow("Set a project with a directory, then dispatch");
  });

  it("operator can set Done; the replayed dispatch stops at Ready", async () => {
    vi.useFakeTimers();
    const client = new DemoClient(null);
    const boot = await client.bootstrap();
    const dirProjects = new Set(boot.projects.filter((p) => p.dir).map((p) => p.id));
    const planned = boot.tasks.find((t) => t.status === "planned" && t.date && t.projectId && dirProjects.has(t.projectId))!;
    const result = await client.dispatch(planned.id);
    expect(result.launched).toBe(false);
    expect(result.pack).toContain(`[trail-task:${planned.id}]`);
    await vi.advanceTimersByTimeAsync(13000);
    const after = await client.bootstrap();
    expect(after.tasks.find((t) => t.id === planned.id)?.status).toBe("ready");
    /* the closed replay session carries its closing claim — the ready
       card's fallback evidence when the artifact strip is empty (D25) */
    const replaySession = after.sessions.find((s) => s.taskId === planned.id && s.id.startsWith("s-replay-"));
    expect(replaySession?.liveStatus).toBe("closed");
    expect(replaySession?.lastAgentMessage).toContain("Finished the brief");
    await client.moveStatus(planned.id, "done");
    expect((await client.bootstrap()).tasks.find((t) => t.id === planned.id)?.status).toBe("done");
    vi.useRealTimers();
  });
});

  it("deleteProject unassigns the project's tasks (ui r2)", async () => {
    const client = new DemoClient(null);
    const boot = await client.bootstrap();
    const project = boot.projects.find((p) => boot.tasks.some((t) => t.projectId === p.id))!;
    const mine = boot.tasks.filter((t) => t.projectId === project.id).map((t) => t.id);
    expect(mine.length).toBeGreaterThan(0);
    await client.deleteProject(project.id);
    const after = await client.bootstrap();
    expect(after.projects.some((p) => p.id === project.id)).toBe(false);
    for (const id of mine) expect(after.tasks.find((t) => t.id === id)?.projectId).toBeUndefined();
    await expect(client.deleteProject(project.id)).rejects.toThrow(/no project/);
  });
