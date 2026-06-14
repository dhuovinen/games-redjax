import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bus } from "@shared/EventBus";
import { WeatherSystem } from "@core/weather/WeatherSystem";

// Initial nextTransitionIn is 120s. transition() uses two Math.random calls:
// the first picks the next state, the second picks the duration.
describe("WeatherSystem", () => {
  let weather: WeatherSystem;

  beforeEach(() => {
    bus.clear();
    weather = new WeatherSystem();
  });

  afterEach(() => vi.restoreAllMocks());

  it("starts clear with zero rain intensity", () => {
    expect(weather.getState()).toBe("clear");
    expect(weather.getRainIntensity()).toBe(0);
  });

  it("does not transition before nextTransitionIn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    weather.update(119);
    expect(weather.getState()).toBe("clear");
  });

  it("transitions clear → cloudy → rain and emits weather:changed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // always the first option
    const onChange = vi.fn();
    bus.on("weather:changed", onChange);

    weather.update(120); // clear → cloudy (duration 60)
    expect(weather.getState()).toBe("cloudy");

    weather.update(60); // cloudy → rain
    expect(weather.getState()).toBe("rain");
    expect(weather.getRainIntensity()).toBeCloseTo(0.6);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0][0]).toEqual({ state: "cloudy" });
    expect(onChange.mock.calls[1][0]).toEqual({ state: "rain" });
  });

  it("does not emit when the state stays the same", () => {
    // roll 0.7 on 'clear' lands on the second option (clear→clear, cumulative 1.0)
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.7) // state pick → clear
      .mockReturnValueOnce(0);  // duration
    const onChange = vi.fn();
    bus.on("weather:changed", onChange);
    weather.update(120);
    expect(weather.getState()).toBe("clear");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports storm intensity as full", () => {
    // clear→cloudy→rain→storm, all first options with random=0
    vi.spyOn(Math, "random").mockReturnValue(0);
    weather.update(120); // cloudy (next in 60)
    weather.update(60);  // rain   (next in 30)
    weather.update(30);  // storm
    expect(weather.getState()).toBe("storm");
    expect(weather.getRainIntensity()).toBe(1);
  });
});
