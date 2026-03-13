interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

export interface ModelRuntimeInfo {
  mode: "webllm" | "wllama" | "cloud";
  reason: string;
}

export function chooseRuntime(): ModelRuntimeInfo {
  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  const nav = navigator as NavigatorWithDeviceMemory;
  const mem = nav.deviceMemory ?? 4;

  if (hasWebGPU && mem >= 8) {
    return { mode: "webllm", reason: "WebGPU available with sufficient memory" };
  }

  if (mem >= 4) {
    return { mode: "wllama", reason: "Fallback to WASM GGUF runtime" };
  }

  return { mode: "cloud", reason: "Insufficient local capability" };
}
