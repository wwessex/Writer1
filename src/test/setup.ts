import { beforeEach, vi } from "vitest";

/* ------------------ matchMedia ------------------ */
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

/* ------------------ localStorage ------------------ */
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

const localStorageMock = new LocalStorageMock();

/* Attach globally */
vi.stubGlobal("localStorage", localStorageMock);

/* Also attach to window (jsdom) */
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
}

/* ------------------ reset between tests ------------------ */
beforeEach(() => {
  localStorageMock.clear();
});
