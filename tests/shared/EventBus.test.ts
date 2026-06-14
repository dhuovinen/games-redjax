import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus, EventBus } from "@shared/EventBus";

describe("EventBus", () => {
  beforeEach(() => bus.clear());

  it("is a singleton", () => {
    expect(EventBus.getInstance()).toBe(bus);
  });

  it("delivers a payload to a subscriber", () => {
    const handler = vi.fn();
    bus.on("honor:changed", handler);
    bus.emit("honor:changed", { value: 0.5, tier: "honorable" });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ value: 0.5, tier: "honorable" });
  });

  it("delivers void events with no payload", () => {
    const handler = vi.fn();
    bus.on("deadeye:activated", handler);
    bus.emit("deadeye:activated");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("fans out to multiple subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on("weapon:fired", a);
    bus.on("weapon:fired", b);
    bus.emit("weapon:fired");
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("off() stops delivery", () => {
    const handler = vi.fn();
    bus.on("weapon:fired", handler);
    bus.off("weapon:fired", handler);
    bus.emit("weapon:fired");
    expect(handler).not.toHaveBeenCalled();
  });

  it("on() returns an unsubscribe function", () => {
    const handler = vi.fn();
    const unsub = bus.on("weapon:fired", handler);
    unsub();
    bus.emit("weapon:fired");
    expect(handler).not.toHaveBeenCalled();
  });

  it("clear() removes all listeners", () => {
    const handler = vi.fn();
    bus.on("weapon:fired", handler);
    bus.clear();
    bus.emit("weapon:fired");
    expect(handler).not.toHaveBeenCalled();
  });

  it("emitting an event with no listeners is a no-op", () => {
    expect(() => bus.emit("player:died")).not.toThrow();
  });
});
