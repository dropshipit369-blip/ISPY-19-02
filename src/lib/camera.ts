export type CameraFacingMode = "environment" | "user";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

/**
 * SES §5: Detect whether the app is running inside the Capacitor Android App Shell.
 * Capacitor always injects `window.Capacitor` on the native bridge.
 */
function isCapacitorAndroidShell(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.() || cap?.platform === "android" || cap?.platform === "ios");
}

const CAMERA_CONSTRAINT_SETS = [
  (facingMode: CameraFacingMode): MediaStreamConstraints => ({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  }),
  (facingMode: CameraFacingMode): MediaStreamConstraints => ({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 960 },
      height: { ideal: 540 },
    },
    audio: false,
  }),
  (facingMode: CameraFacingMode): MediaStreamConstraints => ({
    video: { facingMode: { ideal: facingMode } },
    audio: false,
  }),
  (): MediaStreamConstraints => ({
    video: true,
    audio: false,
  }),
];

function isLocalOrigin() {
  if (typeof window === "undefined") return false;
  return LOCAL_HOSTNAMES.has(window.location.hostname);
}

/**
 * SES §5 Permission Handshake:
 * Enforce strict HTTPS and Android App Shell checks before requesting camera access.
 * Returns a human-readable issue string if the environment cannot support camera access,
 * or null when the environment is suitable.
 */
export function getCameraEnvironmentIssue(): string | null {
  if (typeof window === "undefined") {
    return "Camera access is only available in the browser.";
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser does not expose camera access. Open iSpy in Chrome, Safari, or the Android app.";
  }

  // Capacitor native shell always satisfies the secure-context requirement.
  const inNativeShell = isCapacitorAndroidShell();

  if (!window.isSecureContext && !isLocalOrigin() && !inNativeShell) {
    return "Camera access requires a secure HTTPS connection or the iSpy Android app. Please open iSpy over HTTPS.";
  }

  return null;
}

/**
 * Returns true when the camera permission has been explicitly denied by the OS or browser.
 * Used to decide whether to surface the "Manual Search" fallback UI (SES §5).
 */
export async function isCameraPermissionDenied(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.permissions) return false;
  try {
    const result = await navigator.permissions.query({ name: "camera" as PermissionName });
    return result.state === "denied";
  } catch {
    return false;
  }
}

export function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera permission was blocked. Allow camera access in your browser or phone settings, then retry.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found on this device.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The camera is already in use by another app or browser tab. Close the other app and retry.";
    }

    if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
      return "This device could not satisfy the requested camera settings. iSpy will retry with a lighter camera mode.";
    }

    if (error.name === "AbortError") {
      return "The camera session was interrupted. Retry the scanner.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to access the camera on this device.";
}

function canRetryWithSofterConstraints(error: unknown) {
  return (
    error instanceof DOMException &&
    [
      "AbortError",
      "ConstraintNotSatisfiedError",
      "NotFoundError",
      "NotReadableError",
      "OverconstrainedError",
      "TrackStartError",
    ].includes(error.name)
  );
}

export async function requestBestEffortCameraStream(facingMode: CameraFacingMode) {
  const environmentIssue = getCameraEnvironmentIssue();
  if (environmentIssue) {
    throw new Error(environmentIssue);
  }

  let lastError: unknown = null;

  for (const buildConstraints of CAMERA_CONSTRAINT_SETS) {
    try {
      return await navigator.mediaDevices.getUserMedia(buildConstraints(facingMode));
    } catch (error) {
      lastError = error;

      if (!canRetryWithSofterConstraints(error)) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(getCameraErrorMessage(lastError));
}

export async function attachCameraStream(
  videoElement: HTMLVideoElement,
  stream: MediaStream,
) {
  videoElement.srcObject = stream;
  videoElement.setAttribute("playsinline", "true");
  videoElement.muted = true;
  await videoElement.play();
}

export function stopCameraStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}
