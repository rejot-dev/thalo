import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ActionInputs } from "../action.js";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  setOutput: vi.fn(),
}));

// Mock @actions/exec
vi.mock("@actions/exec", () => ({
  exec: vi.fn(),
  getExecOutput: vi.fn(),
}));

// Mock @actions/github
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => ({
    rest: {
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({
          data: { html_url: "https://github.com/test/repo/pull/1", number: 1 },
        }),
        update: vi.fn(),
      },
    },
  })),
  context: { repo: { owner: "test", repo: "repo" } },
}));

// Mock @rejot-dev/thalo
vi.mock("@rejot-dev/thalo", () => ({
  runActualize: vi.fn(),
}));

// Mock @rejot-dev/thalo/change-tracker/node
vi.mock("@rejot-dev/thalo/change-tracker/node", () => ({
  createChangeTracker: vi.fn().mockResolvedValue({ type: "git" }),
}));

// Mock workspace loader
vi.mock("../workspace.js", () => ({
  loadWorkspace: vi.fn().mockResolvedValue({}),
}));

describe("runSynthesisAction", () => {
  const baseInputs: ActionInputs = {
    githubToken: "fake-token",
    command: "node synthesize.js",
    syntheses: [],
    workingDirectory: ".",
    branchName: "thalo/update-syntheses",
    prTitle: "Update Thalo Syntheses",
    commitMessage: "chore: update syntheses",
    baseBranch: "main",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("exits early when all syntheses are up to date", async () => {
    const { runActualize } = await import("@rejot-dev/thalo");
    vi.mocked(runActualize).mockResolvedValue({
      syntheses: [
        {
          isUpToDate: true,
          linkId: "test",
          title: "Test",
          file: "test.md",
          sources: [],
          prompt: null,
          entries: [],
          currentCheckpoint: { type: "git", value: "abc123" },
          lastCheckpoint: null,
        },
      ],
      trackerType: "git",
      notFoundLinkIds: [],
    });

    const { runSynthesisAction } = await import("../action.js");
    await runSynthesisAction(baseInputs);

    const core = await import("@actions/core");
    expect(vi.mocked(core.info)).toHaveBeenCalledWith("All syntheses are up to date");
    expect(vi.mocked(core.setOutput)).toHaveBeenCalledWith("syntheses-updated", 0);
  });

  it("runs user command for each pending synthesis", async () => {
    const { runActualize } = await import("@rejot-dev/thalo");
    const exec = await import("@actions/exec");

    vi.mocked(runActualize).mockResolvedValue({
      syntheses: [
        {
          isUpToDate: false,
          linkId: "syn1",
          title: "Syn 1",
          file: "syn1.md",
          sources: ["lore"],
          prompt: "Generate synthesis",
          entries: [
            {
              file: "entries.thalo",
              timestamp: "2026-01-15T10:00Z",
              entity: "lore",
              title: "Test Entry",
              linkId: null,
              tags: ["test"],
              rawText: "2026-01-15T10:00Z create lore...",
            },
          ],
          currentCheckpoint: { type: "git", value: "abc123" },
          lastCheckpoint: null,
        },
        {
          isUpToDate: false,
          linkId: "syn2",
          title: "Syn 2",
          file: "syn2.md",
          sources: ["journal"],
          prompt: "Generate another synthesis",
          entries: [],
          currentCheckpoint: { type: "git", value: "abc123" },
          lastCheckpoint: { type: "git", value: "def456" },
        },
      ],
      trackerType: "git",
      notFoundLinkIds: [],
    });

    // Mock git commands
    vi.mocked(exec.exec).mockResolvedValue(0);
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: "M file.md",
      stderr: "",
      exitCode: 0,
    });

    const { runSynthesisAction } = await import("../action.js");
    await runSynthesisAction(baseInputs);

    // Should run the user command twice (once per pending synthesis)
    const execCalls = vi.mocked(exec.exec).mock.calls;
    const commandCalls = execCalls.filter((call) => call[0] === "node synthesize.js");
    expect(commandCalls).toHaveLength(2);

    // Check that synthesis JSON was passed via stdin
    for (const call of commandCalls) {
      expect(call[2]).toHaveProperty("input");
      const input = JSON.parse((call[2] as { input: Buffer }).input.toString());
      expect(input).toHaveProperty("linkId");
      expect(input).toHaveProperty("currentCheckpoint");
    }
  });

  it("creates PR when changes are detected", async () => {
    const { runActualize } = await import("@rejot-dev/thalo");
    const exec = await import("@actions/exec");

    vi.mocked(runActualize).mockResolvedValue({
      syntheses: [
        {
          isUpToDate: false,
          linkId: "test",
          title: "Test",
          file: "test.md",
          sources: [],
          prompt: "Test prompt",
          entries: [],
          currentCheckpoint: { type: "git", value: "abc123" },
          lastCheckpoint: null,
        },
      ],
      trackerType: "git",
      notFoundLinkIds: [],
    });

    vi.mocked(exec.exec).mockResolvedValue(0);
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: "M file.md",
      stderr: "",
      exitCode: 0,
    });

    const { runSynthesisAction } = await import("../action.js");
    await runSynthesisAction(baseInputs);

    const core = await import("@actions/core");
    expect(vi.mocked(core.setOutput)).toHaveBeenCalledWith(
      "pull-request-url",
      "https://github.com/test/repo/pull/1",
    );
    expect(vi.mocked(core.setOutput)).toHaveBeenCalledWith("pull-request-number", 1);
    expect(vi.mocked(core.setOutput)).toHaveBeenCalledWith("syntheses-updated", 1);
  });

  it("updates existing PR when one exists", async () => {
    const { runActualize } = await import("@rejot-dev/thalo");
    const exec = await import("@actions/exec");
    const github = await import("@actions/github");

    vi.mocked(runActualize).mockResolvedValue({
      syntheses: [
        {
          isUpToDate: false,
          linkId: "test",
          title: "Test",
          file: "test.md",
          sources: [],
          prompt: "Test prompt",
          entries: [],
          currentCheckpoint: { type: "git", value: "abc123" },
          lastCheckpoint: null,
        },
      ],
      trackerType: "git",
      notFoundLinkIds: [],
    });

    vi.mocked(exec.exec).mockResolvedValue(0);
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: "M file.md",
      stderr: "",
      exitCode: 0,
    });

    // Mock existing PR
    const mockOctokit = {
      rest: {
        pulls: {
          list: vi.fn().mockResolvedValue({
            data: [{ html_url: "https://github.com/test/repo/pull/42", number: 42 }],
          }),
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    };
    vi.mocked(github.getOctokit).mockReturnValue(
      mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
    );

    const { runSynthesisAction } = await import("../action.js");
    await runSynthesisAction(baseInputs);

    expect(mockOctokit.rest.pulls.update).toHaveBeenCalled();
    expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled();

    const core = await import("@actions/core");
    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      "Updated existing PR: https://github.com/test/repo/pull/42",
    );
  });

  it("warns about not found syntheses", async () => {
    const { runActualize } = await import("@rejot-dev/thalo");

    vi.mocked(runActualize).mockResolvedValue({
      syntheses: [],
      trackerType: "git",
      notFoundLinkIds: ["missing-synthesis"],
    });

    const { runSynthesisAction } = await import("../action.js");
    await runSynthesisAction({ ...baseInputs, syntheses: ["missing-synthesis"] });

    const core = await import("@actions/core");
    expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
      "No synthesis found with link ID: ^missing-synthesis",
    );
  });

  it("exits without PR when no file changes detected", async () => {
    const { runActualize } = await import("@rejot-dev/thalo");
    const exec = await import("@actions/exec");

    vi.mocked(runActualize).mockResolvedValue({
      syntheses: [
        {
          isUpToDate: false,
          linkId: "test",
          title: "Test",
          file: "test.md",
          sources: [],
          prompt: "Test prompt",
          entries: [],
          currentCheckpoint: { type: "git", value: "abc123" },
          lastCheckpoint: null,
        },
      ],
      trackerType: "git",
      notFoundLinkIds: [],
    });

    vi.mocked(exec.exec).mockResolvedValue(0);
    // No changes detected
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    const { runSynthesisAction } = await import("../action.js");
    await runSynthesisAction(baseInputs);

    const core = await import("@actions/core");
    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      "No file changes detected after running commands",
    );
    expect(vi.mocked(core.setOutput)).toHaveBeenCalledWith("syntheses-updated", 0);
  });
});

describe("formatSynthesisForCommand", () => {
  it("formats synthesis correctly for command input", async () => {
    const { runActualize } = await import("@rejot-dev/thalo");
    const exec = await import("@actions/exec");

    const testSynthesis = {
      isUpToDate: false,
      linkId: "test-syn",
      title: "Test Synthesis",
      file: "test.md",
      sources: ["lore where #tag"],
      prompt: "Generate a test synthesis",
      entries: [
        {
          file: "entries.thalo",
          timestamp: "2026-01-15T10:00Z",
          entity: "lore",
          title: "Entry Title",
          linkId: "entry-link",
          tags: ["tag1", "tag2"],
          rawText: "2026-01-15T10:00Z create lore...",
        },
      ],
      currentCheckpoint: { type: "git" as const, value: "abc123def456" },
      lastCheckpoint: { type: "git" as const, value: "old123" },
    };

    vi.mocked(runActualize).mockResolvedValue({
      syntheses: [testSynthesis],
      trackerType: "git",
      notFoundLinkIds: [],
    });

    vi.mocked(exec.exec).mockResolvedValue(0);
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    let capturedInput: string | undefined;
    vi.mocked(exec.exec).mockImplementation(async (cmd, _args, options) => {
      if (cmd === "node synthesize.js" && options?.input) {
        capturedInput = options.input.toString();
      }
      return 0;
    });

    const { runSynthesisAction } = await import("../action.js");
    await runSynthesisAction({
      githubToken: "token",
      command: "node synthesize.js",
      syntheses: [],
      workingDirectory: ".",
      branchName: "test-branch",
      prTitle: "Test PR",
      commitMessage: "test commit",
      baseBranch: "main",
    });

    expect(capturedInput).toBeDefined();
    const parsed = JSON.parse(capturedInput!);

    expect(parsed).toEqual({
      file: "test.md",
      title: "Test Synthesis",
      linkId: "test-syn",
      sources: ["lore where #tag"],
      prompt: "Generate a test synthesis",
      entries: [
        {
          file: "entries.thalo",
          timestamp: "2026-01-15T10:00Z",
          entity: "lore",
          title: "Entry Title",
          linkId: "entry-link",
          tags: ["tag1", "tag2"],
          rawText: "2026-01-15T10:00Z create lore...",
        },
      ],
      currentCheckpoint: "git:abc123def456",
      lastCheckpoint: "git:old123",
    });
  });
});
