import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createVisualizationToolHandlers,
  VISUALIZATION_FUNCTION_DECLARATIONS,
} from "../lib/visualization-tools";

describe("visualization tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("supports generate_diagram alias and expands short topic input", async () => {
    const setMode = vi.fn();
    const setVisualization = vi.fn();
    const setContentView = vi.fn();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        imageData: "data:image/png;base64,abc123",
      }),
    } as Response);

    const handlers = createVisualizationToolHandlers({
      getCanvasEditor: () => null,
      actions: {
        setMode,
        setVisualization,
        clearVisualization: vi.fn(),
      },
      setContentView,
    });

    const result = await handlers.generate_diagram({
      topic: "mitosis",
    });

    expect(result.success).toBe(true);
    expect(setContentView).toHaveBeenCalledWith("visualization");
    expect(setMode).toHaveBeenNthCalledWith(1, "generating");
    expect(setMode).toHaveBeenNthCalledWith(2, "ready");
    expect(setVisualization).toHaveBeenCalledTimes(1);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.imageDescription.toLowerCase()).toContain("mitosis");
  });

  it("returns a clear error when no diagram prompt/topic is provided", async () => {
    const handlers = createVisualizationToolHandlers({
      getCanvasEditor: () => null,
      actions: {
        setMode: vi.fn(),
        setVisualization: vi.fn(),
        clearVisualization: vi.fn(),
      },
      setContentView: vi.fn(),
    });

    const result = await handlers.generate_visualization({});
    expect(result.success).toBe(false);
    expect(String(result.message).toLowerCase()).toContain("topic");
  });

  it("declares the generate_diagram function for the model", () => {
    const toolNames = VISUALIZATION_FUNCTION_DECLARATIONS.map((tool) => tool.name);
    expect(toolNames).toContain("generate_visualization");
    expect(toolNames).toContain("generate_diagram");
  });
});
